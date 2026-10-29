import { instanteDesdeHoraMadrid, partesEnMadrid } from "@/lib/work-logs";

/**
 * Fechas del histórico demo, relativas a `ahora`: el "mes k" (k = 1…12) es el
 * mes natural en Europe/Madrid de hace 12 − k meses, así que el mes 12 es el
 * actual. El seed funciona igual en cualquier año.
 */

export const MESES_HISTORICO = 12;

export type MesHistorico = {
  year: number;
  month: number;
  /** Día 1 a las 00:00 en Madrid (incluido). */
  inicio: Date;
  /** Día 1 del mes siguiente a las 00:00 en Madrid (excluido). */
  fin: Date;
  dias: number;
};

export function mesHistorico(k: number, ahora: Date): MesHistorico {
  if (!Number.isInteger(k) || k < 1 || k > MESES_HISTORICO) {
    throw new RangeError(`Mes del histórico fuera de rango: ${k}`);
  }

  const actual = partesEnMadrid(ahora);
  const indice = actual.year * 12 + (actual.month - 1) - (MESES_HISTORICO - k);
  const year = Math.floor(indice / 12);
  const month = (indice % 12) + 1;

  return {
    year,
    month,
    inicio: instanteDesdeHoraMadrid(year, month, 1),
    fin: instanteDesdeHoraMadrid(year, month + 1, 1),
    dias: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  };
}

/**
 * Día y hora fijos del mes k en Madrid. El día se recorta al último del mes
 * (31 en un mes de 30 días = día 30). En el mes actual, el mes completo se
 * comprime en el tramo ya transcurrido (del día 1 a `ahora`): conserva el orden
 * de las fechas y ninguna cae en el futuro.
 */
export function fechaHistorico(
  k: number,
  dia: number,
  hora: number,
  ahora: Date,
  minuto = 0,
): Date {
  const mes = mesHistorico(k, ahora);
  const fecha = instanteDesdeHoraMadrid(mes.year, mes.month, Math.min(dia, mes.dias), hora, minuto);

  if (k < MESES_HISTORICO) {
    return fecha;
  }

  const transcurrido = ahora.getTime() - mes.inicio.getTime();
  const fraccion =
    (fecha.getTime() - mes.inicio.getTime()) / (mes.fin.getTime() - mes.inicio.getTime());

  return new Date(mes.inicio.getTime() + Math.floor(fraccion * transcurrido));
}

const MS_HORA = 60 * 60 * 1000;

/** Instante `horas` antes de `ahora` (para lo reciente: pendientes, en curso). */
export function haceHoras(ahora: Date, horas: number): Date {
  return new Date(ahora.getTime() - horas * MS_HORA);
}

/** Desplaza un instante un número (con decimales) de días. */
export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 24 * MS_HORA);
}
