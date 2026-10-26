import { prisma } from "@/lib/db";
import {
  ESTADOS_FINALES,
  esEstadoFinal,
  type RolTaller,
} from "@/lib/service-status";
import { cerrarFichajesAbiertosEnTx } from "@/server/data/work-logs";

export type TrabajadorAsignable = {
  id: string;
  name: string;
  email: string;
};

export type MotivoAsignacion =
  | "no-existe"
  | "conflicto"
  | "estado-final"
  | "trabajador-invalido"
  | "mismo-asignado"
  | "no-disponible"
  | "no-autorizado"
  | "motivo-obligatorio";

export type ResultadoAsignacion =
  | { ok: true }
  | { ok: false; motivo: MotivoAsignacion };

export type DatosAsignacion = {
  requestId: string;
  assigneeId: string;
  assigneeEsperadoId: string | null;
  actorId: string;
  motivo?: string | null;
};

export type DatosToma = {
  requestId: string;
  actorId: string;
  actorRol: RolTaller;
};

export type DatosDevolucion = {
  requestId: string;
  actorId: string;
  actorRol: RolTaller;
  motivo: string;
};

export async function listarTrabajadoresAsignables(): Promise<
  TrabajadorAsignable[]
> {
  return prisma.user.findMany({
    where: { role: "trabajador" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}

/**
 * Asignación o reasignación manual del staff. La condición incluye el
 * responsable que vio el formulario y el estado no final: si otra persona
 * cambió algo mientras tanto, no se escribe nada.
 */
export async function asignarSolicitudStaff(
  datos: DatosAsignacion,
): Promise<ResultadoAsignacion> {
  const ahora = new Date();
  const motivo = datos.motivo?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const solicitud = await tx.serviceRequest.findUnique({
      where: { id: datos.requestId },
      select: { status: true, assigneeId: true },
    });

    if (!solicitud) {
      return { ok: false as const, motivo: "no-existe" as const };
    }

    if (esEstadoFinal(solicitud.status)) {
      return { ok: false as const, motivo: "estado-final" as const };
    }

    if (solicitud.assigneeId !== datos.assigneeEsperadoId) {
      return { ok: false as const, motivo: "conflicto" as const };
    }

    if (solicitud.assigneeId === datos.assigneeId) {
      return { ok: false as const, motivo: "mismo-asignado" as const };
    }

    const trabajador = await tx.user.findUnique({
      where: { id: datos.assigneeId },
      select: { role: true },
    });

    if (!trabajador || trabajador.role !== "trabajador") {
      return { ok: false as const, motivo: "trabajador-invalido" as const };
    }

    const actualizada = await tx.serviceRequest.updateMany({
      where: {
        id: datos.requestId,
        assigneeId: datos.assigneeEsperadoId,
        status: { notIn: [...ESTADOS_FINALES] },
      },
      data: {
        assigneeId: datos.assigneeId,
        lastActivityAt: ahora,
      },
    });

    if (actualizada.count === 0) {
      return { ok: false as const, motivo: "conflicto" as const };
    }

    if (solicitud.assigneeId) {
      await cerrarFichajesAbiertosEnTx(tx, {
        requestId: datos.requestId,
        userId: solicitud.assigneeId,
        endedAt: ahora,
      });
    }

    await tx.serviceAssignmentHistory.create({
      data: {
        requestId: datos.requestId,
        fromAssigneeId: solicitud.assigneeId,
        toAssigneeId: datos.assigneeId,
        changedById: datos.actorId,
        reason: motivo,
      },
    });

    return { ok: true as const };
  });
}

/**
 * Autoasignación de una reparación aceptada y sin responsable. El `updateMany`
 * condicional es lo que garantiza que dos trabajadores no la tomen a la vez.
 */
export async function tomarSolicitudTrabajador(
  datos: DatosToma,
): Promise<ResultadoAsignacion> {
  if (datos.actorRol !== "trabajador") {
    return { ok: false, motivo: "no-autorizado" };
  }

  const ahora = new Date();

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.serviceRequest.updateMany({
      where: {
        id: datos.requestId,
        status: "aceptada",
        assigneeId: null,
      },
      data: {
        assigneeId: datos.actorId,
        lastActivityAt: ahora,
      },
    });

    if (actualizada.count === 0) {
      return { ok: false as const, motivo: "no-disponible" as const };
    }

    await tx.serviceAssignmentHistory.create({
      data: {
        requestId: datos.requestId,
        fromAssigneeId: null,
        toAssigneeId: datos.actorId,
        changedById: datos.actorId,
        reason: null,
      },
    });

    return { ok: true as const };
  });
}

/**
 * Devolución del trabajador asignado. Conserva el estado, quita el responsable,
 * cierra su fichaje abierto y deja el motivo en el historial.
 */
export async function devolverSolicitudTrabajador(
  datos: DatosDevolucion,
): Promise<ResultadoAsignacion> {
  if (datos.actorRol !== "trabajador") {
    return { ok: false, motivo: "no-autorizado" };
  }

  const motivo = datos.motivo.trim();

  if (!motivo) {
    return { ok: false, motivo: "motivo-obligatorio" };
  }

  const ahora = new Date();

  return prisma.$transaction(async (tx) => {
    const solicitud = await tx.serviceRequest.findUnique({
      where: { id: datos.requestId },
      select: { status: true, assigneeId: true },
    });

    // No revelamos si existe una reparación asignada a otro trabajador.
    if (!solicitud || solicitud.assigneeId !== datos.actorId) {
      return { ok: false as const, motivo: "no-existe" as const };
    }

    if (esEstadoFinal(solicitud.status)) {
      return { ok: false as const, motivo: "estado-final" as const };
    }

    const actualizada = await tx.serviceRequest.updateMany({
      where: {
        id: datos.requestId,
        assigneeId: datos.actorId,
        status: { notIn: [...ESTADOS_FINALES] },
      },
      data: {
        assigneeId: null,
        lastActivityAt: ahora,
      },
    });

    if (actualizada.count === 0) {
      return { ok: false as const, motivo: "conflicto" as const };
    }

    await cerrarFichajesAbiertosEnTx(tx, {
      requestId: datos.requestId,
      userId: datos.actorId,
      endedAt: ahora,
    });

    await tx.serviceAssignmentHistory.create({
      data: {
        requestId: datos.requestId,
        fromAssigneeId: datos.actorId,
        toAssigneeId: null,
        changedById: datos.actorId,
        reason: motivo,
      },
    });

    return { ok: true as const };
  });
}
