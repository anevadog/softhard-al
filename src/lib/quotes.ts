import { formatEuros } from "@/lib/format";

/**
 * Reglas de negocio de presupuestos. Se opera en céntimos para no arrastrar
 * errores de coma flotante en restas de importes.
 */

const MAX_IMPORTE = 999999.99;

function aCentimos(importe: number): number {
  return Math.round(importe * 100);
}

/**
 * Regla del descuento: si el cliente acepta, paga el presupuesto menos la
 * tarifa de diagnóstico ya abonada.
 */
export function calcularImporteSiAcepta(
  presupuesto: number,
  tarifaDiagnostico: number,
): number {
  return (aCentimos(presupuesto) - aCentimos(tarifaDiagnostico)) / 100;
}

/** Si el cliente rechaza, solo abona la tarifa de diagnóstico. */
export function calcularImporteSiRechaza(tarifaDiagnostico: number): number {
  return aCentimos(tarifaDiagnostico) / 100;
}

/**
 * Validación de negocio del importe propuesto. Devuelve el mensaje de error o
 * `null` si es válido. El formato ya lo valida Zod antes.
 */
export function validarPresupuesto(
  presupuesto: number,
  tarifaDiagnostico: number,
): string | null {
  if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
    return "El importe debe ser mayor que 0.";
  }

  if (presupuesto > MAX_IMPORTE) {
    return `El importe no puede superar ${formatEuros(MAX_IMPORTE)}.`;
  }

  if (aCentimos(presupuesto) < aCentimos(tarifaDiagnostico)) {
    return `El presupuesto no puede ser inferior a la tarifa de diagnóstico (${formatEuros(
      tarifaDiagnostico,
    )}).`;
  }

  return null;
}

/** Fecha de expiración del presupuesto: base + N días de configuración. */
export function calcularExpiracion(base: Date, dias: number): Date {
  const resultado = new Date(base);

  resultado.setDate(resultado.getDate() + dias);

  return resultado;
}
