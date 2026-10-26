import { ZONA_HORARIA } from "@/lib/format";

/**
 * Reglas puras del fichaje. Los instantes se guardan en UTC; las semanas y las
 * horas que escribe el staff se interpretan en Europe/Madrid, con lunes como
 * primer día de la semana.
 */

const MS_MINUTO = 60_000;
const MS_HORA = 60 * MS_MINUTO;

export type IntervaloFichaje = {
  startedAt: Date;
  endedAt: Date | null;
};

/** Minutos completos del fichaje. Uno abierto cuenta hasta `ahora`. */
export function minutosFichaje(fichaje: IntervaloFichaje, ahora: Date): number {
  const fin = fichaje.endedAt ?? ahora;

  return Math.max(0, Math.floor((fin.getTime() - fichaje.startedAt.getTime()) / MS_MINUTO));
}

export function totalMinutos(fichajes: readonly IntervaloFichaje[], ahora: Date): number {
  return fichajes.reduce((total, fichaje) => total + minutosFichaje(fichaje, ahora), 0);
}

/** "45 min", "2 h" o "3 h 05 min". */
export function formatearDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) {
    return `${resto} min`;
  }

  return resto === 0 ? `${horas} h` : `${horas} h ${String(resto).padStart(2, "0")} min`;
}

/** Un fichaje abierto supera el umbral configurable de horas. */
export function excedeHorasAbierto(
  fichaje: IntervaloFichaje,
  horas: number,
  ahora: Date,
): boolean {
  return (
    fichaje.endedAt === null &&
    ahora.getTime() - fichaje.startedAt.getTime() > horas * MS_HORA
  );
}

export type GrupoMinutos<K> = { clave: K; minutos: number };

/** Suma minutos por clave (por ejemplo, reparación) conservando el primer orden de aparición. */
export function minutosPorClave<T extends IntervaloFichaje, K>(
  fichajes: readonly T[],
  clave: (fichaje: T) => K,
  ahora: Date,
): GrupoMinutos<K>[] {
  const grupos = new Map<K, number>();

  for (const fichaje of fichajes) {
    const k = clave(fichaje);
    grupos.set(k, (grupos.get(k) ?? 0) + minutosFichaje(fichaje, ahora));
  }

  return [...grupos].map(([k, minutos]) => ({ clave: k, minutos }));
}

// --- Zona horaria ------------------------------------------------------------

const partesFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type PartesFecha = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partesEnMadrid(instante: Date): PartesFecha {
  const partes = Object.fromEntries(
    partesFormatter
      .formatToParts(instante)
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, Number(parte.value)]),
  ) as Record<string, number>;

  return {
    year: partes.year!,
    month: partes.month!,
    day: partes.day!,
    hour: partes.hour!,
    minute: partes.minute!,
    second: partes.second!,
  };
}

/** Diferencia en ms entre la hora de Madrid y UTC en ese instante. */
function desfaseMadrid(instante: Date): number {
  const p = partesEnMadrid(instante);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/**
 * Instante UTC de una hora de pared en Madrid. Los meses van de 1 a 12 y se
 * admiten días desbordados (32 de octubre = 1 de noviembre). En la hora que no
 * existe al adelantar el reloj, el resultado cae justo después del salto.
 */
export function instanteDesdeHoraMadrid(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const comoUtc = Date.UTC(year, month - 1, day, hour, minute);
  const primero = desfaseMadrid(new Date(comoUtc));
  const candidato = comoUtc - primero;
  const segundo = desfaseMadrid(new Date(candidato));

  return new Date(primero === segundo ? candidato : comoUtc - segundo);
}

const PATRON_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Convierte el valor de un `<input type="datetime-local">` (hora de Madrid) a UTC. */
export function instanteDesdeInputMadrid(valor: string): Date | null {
  const coincidencia = PATRON_INPUT.exec(valor.trim());

  if (!coincidencia) {
    return null;
  }

  const [year, month, day, hour, minute] = coincidencia.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const fechaValida = new Date(Date.UTC(year, month - 1, day));

  if (
    fechaValida.getUTCFullYear() !== year ||
    fechaValida.getUTCMonth() !== month - 1 ||
    fechaValida.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  return instanteDesdeHoraMadrid(year, month, day, hour, minute);
}

/** Valor para un `<input type="datetime-local">` con la hora de Madrid. */
export function inputMadridDesdeInstante(instante: Date): string {
  const p = partesEnMadrid(instante);
  const dos = (n: number) => String(n).padStart(2, "0");

  return `${p.year}-${dos(p.month)}-${dos(p.day)}T${dos(p.hour)}:${dos(p.minute)}`;
}

// --- Semanas -----------------------------------------------------------------

export type SemanaTaller = {
  /** Lunes de la semana en hora de Madrid, formato YYYY-MM-DD. */
  clave: string;
  /** Lunes 00:00 en Madrid, como instante UTC (incluido). */
  inicio: Date;
  /** Lunes siguiente 00:00 en Madrid, como instante UTC (excluido). */
  fin: Date;
};

function semanaDesdeLunes(year: number, month: number, day: number): SemanaTaller {
  const lunes = new Date(Date.UTC(year, month - 1, day));
  const clave = lunes.toISOString().slice(0, 10);

  return {
    clave,
    inicio: instanteDesdeHoraMadrid(
      lunes.getUTCFullYear(),
      lunes.getUTCMonth() + 1,
      lunes.getUTCDate(),
    ),
    fin: instanteDesdeHoraMadrid(
      lunes.getUTCFullYear(),
      lunes.getUTCMonth() + 1,
      lunes.getUTCDate() + 7,
    ),
  };
}

/** Semana (lunes a domingo en Madrid) que contiene el instante. */
export function semanaDe(instante: Date): SemanaTaller {
  const p = partesEnMadrid(instante);
  const diaSemana = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const retroceso = (diaSemana + 6) % 7;

  return semanaDesdeLunes(p.year, p.month, p.day - retroceso);
}

/**
 * Semana a partir de `?semana=YYYY-MM-DD`. Cualquier día sirve: se normaliza a
 * su lunes. Un valor ausente o inválido devuelve la semana de `ahora`.
 */
export function semanaDesdeClave(clave: string | null | undefined, ahora: Date): SemanaTaller {
  const coincidencia = clave ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(clave) : null;

  if (!coincidencia) {
    return semanaDe(ahora);
  }

  const [year, month, day] = coincidencia.slice(1).map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(year, month - 1, day));

  if (
    fecha.getUTCFullYear() !== year ||
    fecha.getUTCMonth() !== month - 1 ||
    fecha.getUTCDate() !== day
  ) {
    return semanaDe(ahora);
  }

  const retroceso = (fecha.getUTCDay() + 6) % 7;

  return semanaDesdeLunes(year, month, day - retroceso);
}

export function desplazarSemana(semana: SemanaTaller, semanas: number): SemanaTaller {
  const [year, month, day] = semana.clave.split("-").map(Number) as [number, number, number];

  return semanaDesdeLunes(year, month, day + semanas * 7);
}
