import type { ServiceStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { calcularImporteSiAcepta, calcularImporteSiRechaza } from "@/lib/quotes";
import {
  puedeCambiarEstado,
  necesitaPresupuesto,
} from "@/lib/service-status";
import {
  SERVICE_STATUSES,
  type SolicitudAdminDetalle,
  type SolicitudAdminResumen,
} from "@/lib/service-requests";

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

export async function listarSolicitudesAdmin(
  estado?: ServiceStatus,
): Promise<SolicitudAdminResumen[]> {
  return prisma.serviceRequest.findMany({
    where: estado ? { status: estado } : undefined,
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
    },
  });
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
      timeSlot: true,
      preferredDate: true,
      expiresAt: true,
      client: { select: { name: true, email: true, phone: true } },
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

export type DatosPresupuesto = {
  requestId: string;
  budgetAmount: number;
  diagnosticFee: number;
  finalAmount: number;
  expiresAt: Date;
};

export type ResultadoCrearPresupuesto =
  | { ok: true; quoteId: string }
  | { ok: false; motivo: "no-existe" | "ya-existe" };

export async function crearPresupuesto(
  datos: DatosPresupuesto,
): Promise<ResultadoCrearPresupuesto> {
  try {
    return await prisma.$transaction(async (tx) => {
      const solicitud = await tx.serviceRequest.findUnique({
        where: { id: datos.requestId },
        select: { id: true, quote: { select: { id: true } } },
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
        data: { status: "diagnosticada", expiresAt: datos.expiresAt },
      });

      return { ok: true as const, quoteId: quote.id };
    });
  } catch (error) {
    // Carrera entre dos pestañas: el @unique de requestId decide.
    if (esConflictoUnico(error)) {
      return { ok: false, motivo: "ya-existe" };
    }

    throw error;
  }
}

export type ResultadoCambioEstado =
  | { ok: true }
  | { ok: false; motivo: "no-existe" | "mismo-estado" | "sin-presupuesto" };

export async function cambiarEstadoSolicitud(
  requestId: string,
  nuevo: ServiceStatus,
): Promise<ResultadoCambioEstado> {
  const solicitud = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      quote: { select: { budgetAmount: true, diagnosticFee: true } },
    },
  });

  if (!solicitud) {
    return { ok: false, motivo: "no-existe" };
  }

  if (
    !puedeCambiarEstado(solicitud.status, nuevo, Boolean(solicitud.quote))
  ) {
    return {
      ok: false,
      motivo:
        solicitud.status === nuevo
          ? "mismo-estado"
          : necesitaPresupuesto(nuevo)
            ? "sin-presupuesto"
            : "mismo-estado",
    };
  }

  const quote = solicitud.quote;
  // Mantener coherente el importe final si el cambio implica una decisión.
  const decision =
    quote && (nuevo === "aceptada" || nuevo === "rechazada")
      ? {
          status: nuevo === "aceptada" ? ("aceptado" as const) : ("rechazado" as const),
          decidedAt: new Date(),
          finalAmount:
            nuevo === "aceptada"
              ? calcularImporteSiAcepta(
                  Number(quote.budgetAmount),
                  Number(quote.diagnosticFee),
                ).toFixed(2)
              : calcularImporteSiRechaza(Number(quote.diagnosticFee)).toFixed(2),
        }
      : null;

  await prisma.$transaction([
    prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: nuevo },
    }),
    ...(decision
      ? [
          prisma.quote.update({
            where: { requestId },
            data: decision,
          }),
        ]
      : []),
  ]);

  return { ok: true };
}

function esConflictoUnico(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
