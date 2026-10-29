import { instanteDesdeHoraMadrid, partesEnMadrid } from "@/lib/work-logs";

/** Reglas puras de la exportación a CSV (4.2). */

export const MAX_DIAS_EXPORTACION = 366;
export const MAX_FILAS_EXPORTACION = 10_000;

export type RangoExportacion = {
  /** `YYYY-MM-DD`, tal como llega en la URL. */
  desde: string;
  hasta: string;
  /** `desde` a las 00:00 en Madrid (incluido). */
  inicio: Date;
  /** El día siguiente a `hasta` a las 00:00 en Madrid (excluido). */
  fin: Date;
};

const PATRON_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Día de calendario válido (`YYYY-MM-DD`) como [año, mes, día], o null. */
export function partesDia(valor: string): [number, number, number] | null {
  const coincidencia = PATRON_DIA.exec(valor);
  if (!coincidencia) return null;

  const [year, month, day] = coincidencia.slice(1).map(Number) as [number, number, number];
  const comprobacion = new Date(Date.UTC(year, month - 1, day));

  return comprobacion.getUTCFullYear() === year &&
    comprobacion.getUTCMonth() === month - 1 &&
    comprobacion.getUTCDate() === day
    ? [year, month, day]
    : null;
}

/** Días naturales de `desde` a `hasta`, ambos incluidos. */
export function diasDelRango(desde: [number, number, number], hasta: [number, number, number]): number {
  const a = Date.UTC(desde[0], desde[1] - 1, desde[2]);
  const b = Date.UTC(hasta[0], hasta[1] - 1, hasta[2]);

  return Math.round((b - a) / 86_400_000) + 1;
}

export function rangoDesdeDias(
  desde: string,
  hasta: string,
): RangoExportacion | null {
  const d = partesDia(desde);
  const h = partesDia(hasta);
  if (!d || !h) return null;

  return {
    desde,
    hasta,
    inicio: instanteDesdeHoraMadrid(d[0], d[1], d[2]),
    fin: instanteDesdeHoraMadrid(h[0], h[1], h[2] + 1),
  };
}

/** Día de Madrid de un instante, como `YYYY-MM-DD` (para los `<input type="date">`). */
export function diaMadrid(instante: Date): string {
  const p = partesEnMadrid(instante);

  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Rango por defecto de los formularios: los últimos `dias` días hasta hoy. */
export function ultimosDias(ahora: Date, dias: number): { desde: string; hasta: string } {
  const hoy = partesEnMadrid(ahora);
  const desde = new Date(Date.UTC(hoy.year, hoy.month - 1, hoy.day - (dias - 1)));

  return { desde: desde.toISOString().slice(0, 10), hasta: diaMadrid(ahora) };
}

/** `ingresos_2026-10-01_2026-10-31.csv`. */
export function nombreFicheroCsv(base: string, rango: { desde: string; hasta: string }): string {
  return `${base}_${rango.desde}_${rango.hasta}.csv`;
}
