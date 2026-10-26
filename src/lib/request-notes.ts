import type { RequestNoteType } from "@/generated/prisma/enums";

/** Notas internas del taller. El cliente nunca las ve. */

export const TIPOS_NOTA = [
  "normal",
  "falta_repuesto",
] as const satisfies readonly RequestNoteType[];

export const NOTE_TYPE_LABELS: Record<RequestNoteType, string> = {
  normal: "Nota",
  falta_repuesto: "Falta de repuesto",
};

export const LONGITUD_MAXIMA_NOTA = 1000;

export type NotaReparacion = {
  id: string;
  type: RequestNoteType;
  body: string;
  createdAt: Date;
  resolvedAt: Date | null;
  author: { name: string } | null;
  resolvedBy: { name: string } | null;
};

/** Una falta de repuesto se destaca hasta que alguien la marca como atendida. */
export function esFaltaPendiente(nota: {
  type: RequestNoteType;
  resolvedAt: Date | null;
}): boolean {
  return nota.type === "falta_repuesto" && nota.resolvedAt === null;
}

/**
 * Faltas de repuesto pendientes primero; dentro de cada bloque, las más
 * recientes arriba. No modifica el array recibido.
 */
export function ordenarNotas<
  T extends { type: RequestNoteType; resolvedAt: Date | null; createdAt: Date },
>(notas: readonly T[]): T[] {
  return [...notas].sort((a, b) => {
    const pendienteA = esFaltaPendiente(a) ? 0 : 1;
    const pendienteB = esFaltaPendiente(b) ? 0 : 1;

    if (pendienteA !== pendienteB) {
      return pendienteA - pendienteB;
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
