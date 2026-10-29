import type { ServiceStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  SERVICE_STATUSES,
  type SolicitudAdminDetalle,
  type SolicitudAdminResumen,
} from "@/lib/service-requests";
import { cobroDesdeFila, SELECT_COBRO } from "@/server/data/payments";
import { aplicarCambioEstadoEnTx } from "@/server/data/service-status";

export type ConfigNegocio = {
  diagnosticFee: number;
  expirationDays: number;
};

export async function obtenerConfig(): Promise<ConfigNegocio | null> {
  const config = await prisma.config.findUnique({
    where: { id: 1 },
    select: { diagnosticFee: true, expirationDays: true },
  });

  if (!config) {
    return null;
  }

  return {
    diagnosticFee: Number(config.diagnosticFee),
    expirationDays: config.expirationDays,
  };
}

/**
 * Listado del panel. `soloFaltasRepuesto` deja solo las reparaciones con alguna
 * falta de repuesto sin atender, filtrando en la consulta.
 */
export async function listarSolicitudesAdmin(
  estado?: ServiceStatus,
  { soloFaltasRepuesto = false }: { soloFaltasRepuesto?: boolean } = {},
): Promise<SolicitudAdminResumen[]> {
  const solicitudes = await prisma.serviceRequest.findMany({
    where: {
      ...(estado ? { status: estado } : {}),
      ...(soloFaltasRepuesto
        ? { notes: { some: { type: "falta_repuesto", resolvedAt: null } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      status: true,
      equipmentType: true,
      brand: true,
      model: true,
      client: { select: { name: true, email: true } },
      quote: { select: { id: true } },
      // Recuento filtrado en la misma consulta: sin cargar las notas.
      _count: {
        select: {
          notes: { where: { type: "falta_repuesto", resolvedAt: null } },
        },
      },
    },
  });

  return solicitudes.map(({ _count, ...solicitud }) => ({
    ...solicitud,
    faltasRepuestoPendientes: _count.notes,
  }));
}

export async function contarPorEstado(): Promise<Record<ServiceStatus, number>> {
  const grupos = await prisma.serviceRequest.groupBy({
    by: ["status"],
    _count: true,
  });

  const conteo = Object.fromEntries(
    SERVICE_STATUSES.map((estado) => [estado, 0]),
  ) as Record<ServiceStatus, number>;

  for (const grupo of grupos) {
    conteo[grupo.status] = grupo._count;
  }

  return conteo;
}

export async function obtenerSolicitudAdmin(
  id: string,
): Promise<SolicitudAdminDetalle | null> {
  const solicitud = await prisma.serviceRequest.findUnique({
    where: { id },
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
      preferredDate: true,
      expiresAt: true,
      ...SELECT_COBRO,
      client: { select: { name: true, email: true, phone: true } },
      assignee: { select: { id: true, name: true, email: true } },
      quote: {
        select: {
          id: true,
          budgetAmount: true,
          diagnosticFee: true,
          finalAmount: true,
          status: true,
          expiresAt: true,
          decidedAt: true,
          createdAt: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          changedBy: { select: { name: true } },
        },
      },
      assignmentHistory: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          reason: true,
          fromAssignee: { select: { name: true, email: true } },
          toAssignee: { select: { name: true, email: true } },
          changedBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!solicitud) {
    return null;
  }

  const { paidAt, paidAmount, paymentMethod, paymentNote, paidBy, ...resto } = solicitud;

  return {
    ...resto,
    cobro: cobroDesdeFila({ paidAt, paidAmount, paymentMethod, paymentNote, paidBy }),
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

export type DatosPresupuesto = {
  requestId: string;
  budgetAmount: number;
  diagnosticFee: number;
  finalAmount: number;
  expiresAt: Date;
  userId: string;
};

export type ResultadoCrearPresupuesto =
  | { ok: true; quoteId: string }
  | { ok: false; motivo: "no-existe" | "ya-existe" | "conflicto" };

class PresupuestoEnConflicto extends Error {}

export async function crearPresupuesto(
  datos: DatosPresupuesto,
): Promise<ResultadoCrearPresupuesto> {
  const ahora = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const solicitud = await tx.serviceRequest.findUnique({
        where: { id: datos.requestId },
        select: {
          id: true,
          status: true,
          quote: { select: { id: true } },
        },
      });

      if (!solicitud) {
        return { ok: false as const, motivo: "no-existe" as const };
      }

      if (solicitud.quote) {
        return { ok: false as const, motivo: "ya-existe" as const };
      }

      const quote = await tx.quote.create({
        data: {
          requestId: datos.requestId,
          // Importes como cadena con 2 decimales: evita cualquier deriva binaria.
          budgetAmount: datos.budgetAmount.toFixed(2),
          diagnosticFee: datos.diagnosticFee.toFixed(2),
          finalAmount: datos.finalAmount.toFixed(2),
          expiresAt: datos.expiresAt,
        },
        select: { id: true },
      });

      await tx.serviceRequest.update({
        where: { id: datos.requestId },
        data: { expiresAt: datos.expiresAt },
      });

      if (solicitud.status !== "diagnosticada") {
        const cambio = await aplicarCambioEstadoEnTx(tx, {
          requestId: datos.requestId,
          estadoEsperado: solicitud.status,
          estadoNuevo: "diagnosticada",
          changedById: datos.userId,
          reason: "Presupuesto creado",
          ahora,
        });

        if (!cambio.ok) {
          throw new PresupuestoEnConflicto();
        }
      } else {
        await tx.serviceRequest.update({
          where: { id: datos.requestId },
          data: { lastActivityAt: ahora },
        });
      }

      return { ok: true as const, quoteId: quote.id };
    });
  } catch (error) {
    // Carrera entre dos pestañas: el @unique de requestId decide.
    if (esConflictoUnico(error)) {
      return { ok: false, motivo: "ya-existe" };
    }

    if (error instanceof PresupuestoEnConflicto) {
      return { ok: false, motivo: "conflicto" };
    }

    throw error;
  }
}

function esConflictoUnico(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
