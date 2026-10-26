import type { Prisma } from "@/generated/prisma/client";
import type { RequestNoteType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { NotaReparacion } from "@/lib/request-notes";
import { ESTADOS_FINALES } from "@/lib/service-status";

export type MotivoNota = "no-disponible" | "no-existe" | "nota-no-existe" | "ya-atendida" | "no-es-falta";

export type ResultadoNota =
  | { ok: true; requestId: string }
  | { ok: false; motivo: MotivoNota };

type DatosNota = {
  requestId: string;
  tipo: RequestNoteType;
  texto: string;
};

const SELECT_NOTA = {
  id: true,
  type: true,
  body: true,
  createdAt: true,
  resolvedAt: true,
  author: { select: { name: true } },
  resolvedBy: { select: { name: true } },
} satisfies Prisma.RequestNoteSelect;

/**
 * Nota del trabajador asignado. El `updateMany` condicional de la reparación
 * va primero: comprueba que sigue siendo suya y abierta, marca la actividad y
 * bloquea la fila frente a una reasignación o un cierre simultáneos. Ajena,
 * inexistente o final reciben la misma respuesta.
 */
export async function crearNotaTrabajador(
  datos: DatosNota & { userId: string },
): Promise<ResultadoNota> {
  return prisma.$transaction(async (tx) => {
    const reparacion = await tx.serviceRequest.updateMany({
      where: {
        id: datos.requestId,
        assigneeId: datos.userId,
        status: { notIn: [...ESTADOS_FINALES] },
      },
      data: { lastActivityAt: new Date() },
    });

    if (reparacion.count === 0) {
      return { ok: false as const, motivo: "no-disponible" as const };
    }

    await tx.requestNote.create({
      data: {
        requestId: datos.requestId,
        authorId: datos.userId,
        type: datos.tipo,
        body: datos.texto.trim(),
      },
    });

    return { ok: true as const, requestId: datos.requestId };
  });
}

/** Nota del encargado o admin en cualquier reparación existente. */
export async function crearNotaStaff(
  datos: DatosNota & { actorId: string },
): Promise<ResultadoNota> {
  return prisma.$transaction(async (tx) => {
    const reparacion = await tx.serviceRequest.updateMany({
      where: { id: datos.requestId },
      data: { lastActivityAt: new Date() },
    });

    if (reparacion.count === 0) {
      return { ok: false as const, motivo: "no-existe" as const };
    }

    await tx.requestNote.create({
      data: {
        requestId: datos.requestId,
        authorId: datos.actorId,
        type: datos.tipo,
        body: datos.texto.trim(),
      },
    });

    return { ok: true as const, requestId: datos.requestId };
  });
}

/**
 * Marca una falta de repuesto como atendida. La condición sobre `type` y
 * `resolvedAt` hace que dos staff a la vez no la atiendan dos veces y que una
 * nota normal nunca se marque.
 */
export async function marcarNotaAtendida(datos: {
  actorId: string;
  noteId: string;
}): Promise<ResultadoNota> {
  const ahora = new Date();

  return prisma.$transaction(async (tx) => {
    const nota = await tx.requestNote.findUnique({
      where: { id: datos.noteId },
      select: { requestId: true, type: true, resolvedAt: true },
    });

    if (!nota) {
      return { ok: false as const, motivo: "nota-no-existe" as const };
    }

    if (nota.type !== "falta_repuesto") {
      return { ok: false as const, motivo: "no-es-falta" as const };
    }

    if (nota.resolvedAt) {
      return { ok: false as const, motivo: "ya-atendida" as const };
    }

    const atendida = await tx.requestNote.updateMany({
      where: { id: datos.noteId, type: "falta_repuesto", resolvedAt: null },
      data: { resolvedAt: ahora, resolvedById: datos.actorId },
    });

    if (atendida.count === 0) {
      return { ok: false as const, motivo: "ya-atendida" as const };
    }

    await tx.serviceRequest.updateMany({
      where: { id: nota.requestId },
      data: { lastActivityAt: ahora },
    });

    return { ok: true as const, requestId: nota.requestId };
  });
}

/** Notas de una reparación para su trabajador: el filtro de responsable va en la consulta. */
export async function listarNotasReparacionTrabajador(
  requestId: string,
  userId: string,
): Promise<NotaReparacion[]> {
  return prisma.requestNote.findMany({
    where: { requestId, request: { assigneeId: userId } },
    orderBy: { createdAt: "desc" },
    select: SELECT_NOTA,
  });
}

/** Notas de una reparación para el detalle del panel. */
export async function listarNotasReparacion(requestId: string): Promise<NotaReparacion[]> {
  return prisma.requestNote.findMany({
    where: { requestId },
    orderBy: { createdAt: "desc" },
    select: SELECT_NOTA,
  });
}

/** Total de faltas de repuesto sin atender en todo el taller. */
export async function contarFaltasRepuestoPendientes(): Promise<number> {
  return prisma.requestNote.count({
    where: { type: "falta_repuesto", resolvedAt: null },
  });
}
