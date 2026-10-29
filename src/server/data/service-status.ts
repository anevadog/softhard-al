import type { Prisma, ServiceStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { exigeCobroParaEntregar } from "@/lib/payments";
import { calcularImporteSiAcepta, calcularImporteSiRechaza } from "@/lib/quotes";
import {
  evaluarCambioEstado,
  type MotivoTransicionInvalida,
  type RolTaller,
} from "@/lib/service-status";
import {
  bloquearEntidadEnTx,
  tieneFacturaVigenteEnTx,
} from "@/server/data/invoices";
import { cerrarFichajesAbiertosEnTx } from "@/server/data/work-logs";

type ClienteTx = Prisma.TransactionClient;

export type MotivoCambioEstado =
  | MotivoTransicionInvalida
  | "no-existe"
  | "conflicto"
  | "requiere-pago"
  | "factura-vigente";

export type ResultadoCambioEstadoSolicitud =
  | { ok: true }
  | { ok: false; motivo: MotivoCambioEstado };

export type DatosCambioEstadoSolicitud = {
  requestId: string;
  estadoEsperado: ServiceStatus;
  estadoNuevo: ServiceStatus;
  actorId: string;
  rol: RolTaller;
  motivo?: string | null;
};

/**
 * Aplica una transición ya autorizada por el llamador. La actualización
 * condicional por `status` es la que resuelve la carrera: si otra pestaña ya
 * cambió la solicitud, no se escribe nada.
 *
 * El historial, `lastActivityAt` y el cierre de fichajes van en la misma
 * transacción. Cualquier estado nuevo distinto de `en_reparacion` cierra los
 * fichajes abiertos, incluidas las correcciones hacia atrás del staff.
 */
export async function aplicarCambioEstadoEnTx(
  tx: ClienteTx,
  datos: {
    requestId: string;
    estadoEsperado: ServiceStatus;
    estadoNuevo: ServiceStatus;
    changedById: string | null;
    reason: string | null;
    assigneeId?: string;
    /** Exige cobro registrado en la misma condición (entrega con importe > 0). */
    exigirCobro?: boolean;
    ahora?: Date;
  },
): Promise<{ ok: true } | { ok: false; motivo: "conflicto" }> {
  const ahora = datos.ahora ?? new Date();

  const actualizada = await tx.serviceRequest.updateMany({
    where: {
      id: datos.requestId,
      status: datos.estadoEsperado,
      ...(datos.assigneeId ? { assigneeId: datos.assigneeId } : {}),
      ...(datos.exigirCobro ? { paidAt: { not: null } } : {}),
    },
    data: {
      status: datos.estadoNuevo,
      lastActivityAt: ahora,
    },
  });

  if (actualizada.count === 0) {
    return { ok: false, motivo: "conflicto" };
  }

  if (datos.estadoNuevo !== "en_reparacion") {
    await cerrarFichajesAbiertosEnTx(tx, {
      requestId: datos.requestId,
      endedAt: ahora,
    });
  }

  await tx.serviceStatusHistory.create({
    data: {
      requestId: datos.requestId,
      fromStatus: datos.estadoEsperado,
      toStatus: datos.estadoNuevo,
      changedById: datos.changedById,
      reason: datos.reason,
    },
  });

  return { ok: true };
}

class CambioEstadoEnConflicto extends Error {}
class CambioBloqueadoPorFactura extends Error {}

/**
 * Cambio manual desde el panel o desde la futura pantalla del trabajador.
 * El trabajador solo puede mover solicitudes asignadas a él y solo por su
 * flujo normal; encargado/admin pueden corregir cualquier estado con motivo.
 */
export async function cambiarEstadoSolicitud(
  datos: DatosCambioEstadoSolicitud,
): Promise<ResultadoCambioEstadoSolicitud> {
  const solicitud = await prisma.serviceRequest.findUnique({
    where: { id: datos.requestId },
    select: {
      status: true,
      assigneeId: true,
      paidAt: true,
      quote: {
        select: {
          status: true,
          budgetAmount: true,
          diagnosticFee: true,
          finalAmount: true,
        },
      },
    },
  });

  if (!solicitud) {
    return { ok: false, motivo: "no-existe" };
  }

  // Un trabajador no debe poder distinguir una solicitud ajena de una
  // inexistente: en ambos casos la respuesta es la misma.
  if (
    datos.rol === "trabajador" &&
    solicitud.assigneeId !== datos.actorId
  ) {
    return { ok: false, motivo: "no-existe" };
  }

  if (solicitud.status !== datos.estadoEsperado) {
    return { ok: false, motivo: "conflicto" };
  }

  const evaluacion = evaluarCambioEstado({
    actual: datos.estadoEsperado,
    nuevo: datos.estadoNuevo,
    rol: datos.rol,
    asignadaAlTrabajador: solicitud.assigneeId === datos.actorId,
    tienePresupuesto: Boolean(solicitud.quote),
    motivo: datos.motivo,
  });

  if (!evaluacion.permitida) {
    return { ok: false, motivo: evaluacion.motivo };
  }

  // Cualquier paso a `entregada` (flujo normal o corrección) exige el cobro si
  // hay algo que cobrar. Se comprueba aquí para dar el mensaje y otra vez en la
  // condición del `updateMany`, por si el estado cambia entre medias.
  const exigirCobro =
    datos.estadoNuevo === "entregada" &&
    exigeCobroParaEntregar(
      solicitud.quote
        ? {
            status: solicitud.quote.status,
            finalAmount:
              solicitud.quote.finalAmount === null
                ? null
                : Number(solicitud.quote.finalAmount),
            diagnosticFee: Number(solicitud.quote.diagnosticFee),
          }
        : null,
    );

  if (exigirCobro && solicitud.paidAt === null) {
    return { ok: false, motivo: "requiere-pago" };
  }

  const motivo = datos.motivo?.trim() || null;
  const ahora = new Date();
  const quote = solicitud.quote;
  const decision =
    quote && (datos.estadoNuevo === "aceptada" || datos.estadoNuevo === "rechazada")
      ? {
          status:
            datos.estadoNuevo === "aceptada"
              ? ("aceptado" as const)
              : ("rechazado" as const),
          decidedAt: ahora,
          finalAmount:
            datos.estadoNuevo === "aceptada"
              ? calcularImporteSiAcepta(
                  Number(quote.budgetAmount),
                  Number(quote.diagnosticFee),
                ).toFixed(2)
              : calcularImporteSiRechaza(Number(quote.diagnosticFee)).toFixed(2),
        }
      : null;

  try {
    await prisma.$transaction(async (tx) => {
      // Con factura vigente solo se permite entregar lo ya cobrado; cualquier
      // otro cambio (incluidas las correcciones) exige antes la rectificativa.
      // Se bloquea la fila y se comprueba antes de escribir nada, para que la
      // rectificativa y el cambio de estado no se crucen.
      const esEntrega =
        datos.estadoEsperado === "lista" && datos.estadoNuevo === "entregada";

      if (!esEntrega) {
        await bloquearEntidadEnTx(tx, { tipo: "solicitud", id: datos.requestId });

        if (await tieneFacturaVigenteEnTx(tx, { tipo: "solicitud", id: datos.requestId })) {
          throw new CambioBloqueadoPorFactura();
        }
      }

      const cambio = await aplicarCambioEstadoEnTx(tx, {
        requestId: datos.requestId,
        estadoEsperado: datos.estadoEsperado,
        estadoNuevo: datos.estadoNuevo,
        changedById: datos.actorId,
        reason: motivo,
        ...(datos.rol === "trabajador"
          ? { assigneeId: datos.actorId }
          : {}),
        exigirCobro,
        ahora,
      });

      if (!cambio.ok) {
        throw new CambioEstadoEnConflicto();
      }

      if (decision) {
        await tx.quote.update({
          where: { requestId: datos.requestId },
          data: decision,
        });
      }
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof CambioBloqueadoPorFactura) {
      return { ok: false, motivo: "factura-vigente" };
    }

    if (error instanceof CambioEstadoEnConflicto) {
      if (exigirCobro) {
        const actual = await prisma.serviceRequest.findUnique({
          where: { id: datos.requestId },
          select: { status: true, paidAt: true },
        });

        if (actual?.status === datos.estadoEsperado && actual.paidAt === null) {
          return { ok: false, motivo: "requiere-pago" };
        }
      }

      return { ok: false, motivo: "conflicto" };
    }

    throw error;
  }
}
