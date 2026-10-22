const euros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un importe en euros con formato local (es-ES).
 * Se usará en presupuestos e importes finales de las solicitudes.
 */
export function formatEuros(amount: number): string {
  return euros.format(amount);
}
