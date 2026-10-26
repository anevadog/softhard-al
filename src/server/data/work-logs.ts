import type { Prisma } from "@/generated/prisma/client";
import type { EquipmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { SemanaTaller } from "@/lib/work-logs";

/** Valor por defecto si la fila de configuración no existe todavía. */
const HORAS_FICHAJE_ABIERTO_POR_DEFECTO = 8;

/**
 * Cierra los fichajes abiertos de una reparación dentro de una transacción.
 * No se limita a un destino concreto: cualquier estado nuevo distinto de
 * `en_reparacion` deja la reparación fuera de la mesa de trabajo.
 */
export async function cerrarFichajesAbiertosEnTx(
  tx: Prisma.TransactionClient,
  datos: {
    requestId: string;
    userId?: string | null;
    endedAt?: Date;
  },
): Promise<number> {
  const resultado = await tx.workLog.updateMany({
    where: {
      requestId: datos.requestId,
      endedAt: null,
      ...(datos.userId ? { userId: datos.userId } : {}),
    },
    data: { endedAt: datos.endedAt ?? new Date() },
  });

  return resultado.count;
}

// --- Tipos -------------------------------------------------------------------

export type ReparacionFichaje = {
  id: string;
  equipmentType: EquipmentType;
  brand: string;
  model: string;
};

export type Fichaje = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  note: string | null;
  editedAt: Date | null;
  editedBy: { name: string } | null;
  user: { id: string; name: string };
  request: ReparacionFichaje | null;
};

export type MotivoFichaje =
  | "ya-abierto"
  | "reparacion-no-disponible"
  | "no-existe"
  | "no-abierto"
  | "no-reabrir"
  | "cierre-aparte"
  | "nota-obligatoria"
  | "salida-anterior"
  | "conflicto";

export type ResultadoFichaje =
  | { ok: true; requestId: string | null }
  | { ok: false; motivo: MotivoFichaje };

export const SELECT_FICHAJE = {
  id: true,
  startedAt: true,
  endedAt: true,
  note: true,
  editedAt: true,
  editedBy: { select: { name: true } },
  user: { select: { id: true, name: true } },
  request: {
    select: { id: true, equipmentType: true, brand: true, model: true },
  },
} satisfies Prisma.WorkLogSelect;

function fallo(motivo: MotivoFichaje): ResultadoFichaje {
  return { ok: false, motivo };
}

/** Violación del índice único parcial `work_logs_open_user_unique`. */
function esFichajeAbiertoDuplicado(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

// --- Trabajador --------------------------------------------------------------

/**
 * Entrada en una reparación propia en `en_reparacion`. El `updateMany`
 * condicional de la solicitud va primero: bloquea su fila, así que un cambio
 * de estado o una reasignación simultáneos esperan y, al aplicarse, cierran
 * este fichaje en su propia transacción. El índice único parcial garantiza un
 * solo fichaje abierto por trabajador aunque haya doble clic o dos dispositivos.
 */
export async function ficharEntradaReparacion(datos: {
  userId: string;
  requestId: string;
}): Promise<ResultadoFichaje> {
  const ahora = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const abierto = await tx.workLog.findFirst({
        where: { userId: datos.userId, endedAt: null },
        select: { id: true },
      });

      if (abierto) {
        return fallo("ya-abierto");
      }

      const reparacion = await tx.serviceRequest.updateMany({
        where: {
          id: datos.requestId,
          assigneeId: datos.userId,
          status: "en_reparacion",
        },
        data: { lastActivityAt: ahora },
      });

      if (reparacion.count === 0) {
        // Ajena, inexistente o fuera de `en_reparacion`: misma respuesta.
        return fallo("reparacion-no-disponible");
      }

      await tx.workLog.create({
        data: {
          userId: datos.userId,
          requestId: datos.requestId,
          startedAt: ahora,
        },
      });

      return { ok: true as const, requestId: datos.requestId };
    });
  } catch (error) {
    if (esFichajeAbiertoDuplicado(error)) {
      return fallo("ya-abierto");
    }

    throw error;
  }
}

/** Entrada en horas generales: sin reparación y con nota obligatoria. */
export async function ficharEntradaGeneral(datos: {
  userId: string;
  nota: string;
}): Promise<ResultadoFichaje> {
  const nota = datos.nota.trim();

  if (!nota) {
    return fallo("nota-obligatoria");
  }

  try {
    // Hora del servidor, igual que la salida: no se mezcla con el reloj de la BD.
    await prisma.workLog.create({
      data: { userId: datos.userId, requestId: null, note: nota, startedAt: new Date() },
    });

    return { ok: true, requestId: null };
  } catch (error) {
    if (esFichajeAbiertoDuplicado(error)) {
      return fallo("ya-abierto");
    }

    throw error;
  }
}

/**
 * Salida del propio fichaje. La condición `endedAt: null` evita cerrar dos
 * veces: si un cambio de estado o el encargado ya lo cerraron, no se escribe.
 */
export async function ficharSalida(datos: {
  userId: string;
  workLogId: string;
}): Promise<ResultadoFichaje> {
  const ahora = new Date();

  return prisma.$transaction(async (tx) => {
    const fichaje = await tx.workLog.findFirst({
      where: { id: datos.workLogId, userId: datos.userId },
      select: { requestId: true, endedAt: true },
    });

    if (!fichaje) {
      return fallo("no-existe");
    }

    if (fichaje.endedAt) {
      return fallo("no-abierto");
    }

    const cerrado = await tx.workLog.updateMany({
      where: { id: datos.workLogId, userId: datos.userId, endedAt: null },
      data: { endedAt: ahora },
    });

    if (cerrado.count === 0) {
      return fallo("no-abierto");
    }

    if (fichaje.requestId) {
      await tx.serviceRequest.updateMany({
        where: { id: fichaje.requestId },
        data: { lastActivityAt: ahora },
      });
    }

    return { ok: true as const, requestId: fichaje.requestId };
  });
}

// --- Encargado / admin -------------------------------------------------------

/** Cierre manual del staff. Deja constancia de quién y cuándo. */
export async function cerrarFichajeStaff(datos: {
  actorId: string;
  workLogId: string;
}): Promise<ResultadoFichaje> {
  const ahora = new Date();

  return prisma.$transaction(async (tx) => {
    const fichaje = await tx.workLog.findUnique({
      where: { id: datos.workLogId },
      select: { requestId: true, endedAt: true },
    });

    if (!fichaje) {
      return fallo("no-existe");
    }

    if (fichaje.endedAt) {
      return fallo("no-abierto");
    }

    const cerrado = await tx.workLog.updateMany({
      where: { id: datos.workLogId, endedAt: null },
      data: { endedAt: ahora, editedById: datos.actorId, editedAt: ahora },
    });

    if (cerrado.count === 0) {
      return fallo("no-abierto");
    }

    if (fichaje.requestId) {
      await tx.serviceRequest.updateMany({
        where: { id: fichaje.requestId },
        data: { lastActivityAt: ahora },
      });
    }

    return { ok: true as const, requestId: fichaje.requestId };
  });
}

/**
 * Corrección del staff: entrada, salida y nota. Nunca cambia el trabajador ni
 * la reparación, no reabre un fichaje cerrado y no cierra uno abierto (para eso
 * está el cierre). Solo se guarda el último editor (`editedById`/`editedAt`).
 */
export async function corregirFichajeStaff(datos: {
  actorId: string;
  workLogId: string;
  inicio: Date;
  fin: Date | null;
  nota: string;
}): Promise<ResultadoFichaje> {
  const ahora = new Date();
  const nota = datos.nota.trim();

  if (datos.fin && datos.fin < datos.inicio) {
    return fallo("salida-anterior");
  }

  return prisma.$transaction(async (tx) => {
    const fichaje = await tx.workLog.findUnique({
      where: { id: datos.workLogId },
      select: { requestId: true, endedAt: true },
    });

    if (!fichaje) {
      return fallo("no-existe");
    }

    const abierto = fichaje.endedAt === null;

    if (abierto && datos.fin) {
      return fallo("cierre-aparte");
    }

    if (!abierto && !datos.fin) {
      return fallo("no-reabrir");
    }

    if (!fichaje.requestId && !nota) {
      return fallo("nota-obligatoria");
    }

    const actualizado = await tx.workLog.updateMany({
      // Si alguien lo cerró o lo reabrió mientras tanto, no se pisa.
      where: {
        id: datos.workLogId,
        endedAt: abierto ? null : { not: null },
      },
      data: {
        startedAt: datos.inicio,
        ...(abierto ? {} : { endedAt: datos.fin }),
        note: nota || null,
        editedById: datos.actorId,
        editedAt: ahora,
      },
    });

    if (actualizado.count === 0) {
      return fallo("conflicto");
    }

    if (fichaje.requestId) {
      await tx.serviceRequest.updateMany({
        where: { id: fichaje.requestId },
        data: { lastActivityAt: ahora },
      });
    }

    return { ok: true as const, requestId: fichaje.requestId };
  });
}

// --- Consultas ---------------------------------------------------------------

export async function obtenerHorasFichajeAbierto(): Promise<number> {
  const config = await prisma.config.findUnique({
    where: { id: 1 },
    select: { openWorkLogHours: true },
  });

  return config?.openWorkLogHours ?? HORAS_FICHAJE_ABIERTO_POR_DEFECTO;
}

export async function obtenerFichajeAbierto(userId: string): Promise<Fichaje | null> {
  return prisma.workLog.findFirst({
    where: { userId, endedAt: null },
    select: SELECT_FICHAJE,
  });
}

/**
 * Fichajes de una reparación vistos por el trabajador: solo si la reparación
 * es suya, con la condición en la propia consulta.
 */
export async function listarFichajesReparacionTrabajador(
  requestId: string,
  userId: string,
): Promise<Fichaje[]> {
  return prisma.workLog.findMany({
    where: { requestId, request: { assigneeId: userId } },
    orderBy: { startedAt: "desc" },
    select: SELECT_FICHAJE,
  });
}

/** Fichajes de una reparación para el detalle del panel. */
export async function listarFichajesReparacion(requestId: string): Promise<Fichaje[]> {
  return prisma.workLog.findMany({
    where: { requestId },
    orderBy: { startedAt: "desc" },
    select: SELECT_FICHAJE,
  });
}

/** Fichajes del trabajador que empiezan dentro de la semana (Madrid). */
export async function listarMisFichajesSemana(
  userId: string,
  semana: SemanaTaller,
): Promise<Fichaje[]> {
  return prisma.workLog.findMany({
    where: {
      userId,
      startedAt: { gte: semana.inicio, lt: semana.fin },
    },
    orderBy: { startedAt: "asc" },
    select: SELECT_FICHAJE,
  });
}

/** Fichajes abiertos de todo el taller, los más antiguos primero. */
export async function listarFichajesAbiertos(): Promise<Fichaje[]> {
  return prisma.workLog.findMany({
    where: { endedAt: null },
    orderBy: { startedAt: "asc" },
    select: SELECT_FICHAJE,
  });
}
