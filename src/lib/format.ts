/**
 * Zona horaria del taller. Todas las fechas se guardan en UTC y se muestran en
 * hora de Madrid, aunque el servidor corra en otra zona (por ejemplo, UTC).
 */
export const ZONA_HORARIA = "Europe/Madrid";

const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fechaCorta = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const fechaHora = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const hora = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const diaSemana = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const mesCorto = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  month: "short",
  year: "2-digit",
});

const mesLargo = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA_HORARIA,
  month: "long",
  year: "numeric",
});

/** "oct 26": eje del gráfico de ingresos. */
export function formatearMesCorto(fecha: Date): string {
  return mesCorto.format(fecha);
}

/** "octubre de 2026": tablas y tooltips. */
export function formatearMes(fecha: Date): string {
  return mesLargo.format(fecha);
}

/**
 * Formatea un importe en euros con formato local (es-ES).
 * Se usa en presupuestos e importes finales de las solicitudes.
 */
export function formatEuros(amount: number): string {
  return euros.format(amount);
}

/** Fecha compacta para tablas y fichas del panel. */
export function formatearFechaCorta(fecha: Date): string {
  return fechaCorta.format(fecha);
}

/** Fecha y hora para historiales y movimientos. */
export function formatearFechaHora(fecha: Date): string {
  return fechaHora.format(fecha);
}

/** Solo la hora (HH:mm) en hora de Madrid, para fichajes. */
export function formatearHora(fecha: Date): string {
  return hora.format(fecha);
}

/** Día de la semana y fecha corta, para agrupar fichajes. */
export function formatearDiaSemana(fecha: Date): string {
  return diaSemana.format(fecha);
}
