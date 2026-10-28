import { prisma } from "@/lib/db";
import {
  estaExpirado,
  puedeDecidir,
  resolverDecision,
  type Decision,
} from "@/lib/quotes";
import type {
  SolicitudClienteDetalle,
  SolicitudResumen,
} from "@/lib/service-requests";
import type { ServiceRequestInput } from "@/lib/validations/service-request";
import { aplicarCambioEstadoEnTx } from "@/server/data/service-status";

/**
 * Capa de datos de solicitudes. Las acciones y páginas no tocan Prisma
 * directamente: así los permisos y el filtrado por cliente quedan en un sitio.
 */

export async function crearSolicitudCliente(
  clientId: string,
  input: ServiceRequestInput,
): Promise<{ id: string }> {
  return prisma.serviceRequest.create({
    data: {
      clientId,
      equipmentType: input.equipmentType,
      brand: input.brand,
      model: input.model,
      issue: input.issue,
      modality: input.modality,
      address: input.address,
      timeSlot: input.timeSlot,
    },
    select: { id: true },
  });
}

/** Conflicto al expirar: sirve para revertir la transacción completa. */
class ExpiracionEnConflicto extends Error {}

/**
 * Expiración perezosa (Fase 1 no tiene cron): al leer, los presupuestos
 * vencidos pasan a `expirado` y su solicitud a `expirada`. Es idempotente.
 *
 * Las candidatas se seleccionan DENTRO de la transacción y cada solicitud se
 * actualiza con la condición `id + status` que se leyó. Así el historial solo
 * se crea para las filas que realmente cambiaron. Preferimos esta estrategia a
 * `updateManyAndReturn` porque necesitamos el estado de origen, que esa
 * operación no devuelve.
 */
export async function expirarPresupuestosVencidos(
  clientId?: string,
): Promise<void> {
  const ahora = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const vencidas = await tx.serviceRequest.findMany({
        where: {
          ...(clientId ? { clientId } : {}),
          status: { in: ["pendiente", "diagnosticada"] },
          quote: { is: { status: "pendiente", expiresAt: { lte: ahora } } },
        },
        select: { id: true, status: true },
      });

      for (const solicitud of vencidas) {
        const quoteActualizado = await tx.quote.updateMany({
          where: {
            requestId: solicitud.id,
            status: "pendiente",
            expiresAt: { lte: ahora },
          },
          data: { status: "expirado" },
        });

        if (quoteActualizado.count === 0) {
          continue;
        }

        const cambio = await aplicarCambioEstadoEnTx(tx, {
          requestId: solicitud.id,
          estadoEsperado: solicitud.status,
          estadoNuevo: "expirada",
          changedById: null,
          reason: "Presupuesto vencido",
          ahora,
        });

        if (!cambio.ok) {
          throw new ExpiracionEnConflicto();
        }
      }
    });
  } catch (error) {
    if (error instanceof ExpiracionEnConflicto) {
      return;
    }

    throw error;
  }
}

export async function listarSolicitudesCliente(clientId: string): Promise<SolicitudResumen[]> {
  await expirarPresupuestosVencidos(clientId);

  return prisma.serviceRequest.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      equipmentType: true,
      brand: true,
      model: true,
      issue: true,
      modality: true,
      timeSlot: true,
      status: true,
      createdAt: true,
    },
  });
}

/**
 * Detalle filtrado por propietario. Devolver `null` en lugar de distinguir
 * entre "no existe" y "es de otro cliente" evita filtrar información.
 */
export async function obtenerSolicitudCliente(
  id: string,
  clientId: string,
): Promise<SolicitudClienteDetalle | null> {
  await expirarPresupuestosVencidos(clientId);

  const solicitud = await prisma.serviceRequest.findFirst({
    where: { id, clientId },
    select: {
      id: true,
      createdAt: true,
      status: true,
      equipmentType: true,
      brand: true,
      model: true,
      issue: true,
      modality: true,
      address: true,
      timeSlot: true,
      quote: {
        select: {
          budgetAmount: true,
          diagnosticFee: true,
          finalAmount: true,
          status: true,
          expiresAt: true,
          decidedAt: true,
        },
      },
    },
  });

  if (!solicitud) {
    return null;
  }

  return {
    ...solicitud,
    quote: solicitud.quote
      ? {
          ...solicitud.quote,
          budgetAmount: Number(solicitud.quote.budgetAmount),
          diagnosticFee: Number(solicitud.quote.diagnosticFee),
          finalAmount:
            solicitud.quote.finalAmount === null
              ? null
              : Number(solicitud.quote.finalAmount),
        }
      : null,
  };
}

export type ResultadoDecision =
  | { ok: true; decision: Decision }
  | {
      ok: false;
      motivo: "no-existe" | "sin-presupuesto" | "no-decidible" | "expirado";
    };

/** Conflicto entre dos decisiones simultáneas: sirve para revertir la transacción. */
class DecisionEnConflicto extends Error {}

export async function decidirPresupuestoCliente(
  requestId: string,
  clientId: string,
  decision: Decision,
): Promise<ResultadoDecision> {
  await expirarPresupuestosVencidos(clientId);

  const solicitud = await prisma.serviceRequest.findFirst({
    where: { id: requestId, clientId },
    select: {
      status: true,
      quote: {
        select: {
          status: true,
          expiresAt: true,
          budgetAmount: true,
          diagnosticFee: true,
        },
      },
    },
  });

  if (!solicitud) {
    return { ok: false, motivo: "no-existe" };
  }

  const quote = solicitud.quote;

  if (!quote) {
    return { ok: false, motivo: "sin-presupuesto" };
  }

  const ahora = new Date();

  if (estaExpirado(quote.expiresAt, ahora)) {
    return { ok: false, motivo: "expirado" };
  }

  if (
    !puedeDecidir(solicitud.status, quote.status, quote.expiresAt, ahora)
  ) {
    return { ok: false, motivo: "no-decidible" };
  }

  const resultado = resolverDecision(
    decision,
    Number(quote.budgetAmount),
    Number(quote.diagnosticFee),
  );

  try {
    const aplicada = await prisma.$transaction(async (tx) => {
      // Escrituras condicionales: si otra pestaña ya decidió, no se toca nada.
      const quoteActualizado = await tx.quote.updateMany({
        where: { requestId, status: "pendiente" },
        data: {
          status: resultado.estadoPresupuesto,
          finalAmount: resultado.importeFinal.toFixed(2),
          decidedAt: ahora,
        },
      });

      if (quoteActualizado.count === 0) {
        return false;
      }

      const cambio = await aplicarCambioEstadoEnTx(tx, {
        requestId,
        estadoEsperado: solicitud.status,
        estadoNuevo: resultado.estadoSolicitud,
        changedById: clientId,
        reason: null,
        ahora,
      });

      if (!cambio.ok) {
        throw new DecisionEnConflicto();
      }

      return true;
    });

    return aplicada
      ? { ok: true, decision }
      : { ok: false, motivo: "no-decidible" };
  } catch (error) {
    if (error instanceof DecisionEnConflicto) {
      return { ok: false, motivo: "no-decidible" };
    }

    throw error;
  }
}

export async function contarSolicitudesCliente(clientId: string): Promise<number> {
  return prisma.serviceRequest.count({ where: { clientId } });
}
