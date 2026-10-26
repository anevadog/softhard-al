import { prisma } from "@/lib/db";
import type { SemanaTaller } from "@/lib/work-logs";
import { SELECT_FICHAJE, type Fichaje } from "@/server/data/work-logs";

/**
 * Fichajes que empiezan dentro de la semana (lunes a lunes en Madrid), de todo
 * el taller o de un trabajador. El filtro va en la consulta.
 */
export async function listarFichajesSemana(
  semana: SemanaTaller,
  trabajadorId: string | null = null,
): Promise<Fichaje[]> {
  return prisma.workLog.findMany({
    where: {
      startedAt: { gte: semana.inicio, lt: semana.fin },
      ...(trabajadorId ? { userId: trabajadorId } : {}),
    },
    orderBy: { startedAt: "asc" },
    select: SELECT_FICHAJE,
  });
}

/** Todos los fichajes de unas reparaciones, para calcular su acumulado histórico. */
export async function listarFichajesDeReparaciones(requestIds: string[]): Promise<Fichaje[]> {
  if (requestIds.length === 0) {
    return [];
  }

  return prisma.workLog.findMany({
    where: { requestId: { in: requestIds } },
    select: SELECT_FICHAJE,
  });
}
