const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fechaCorta = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const fechaHora = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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

