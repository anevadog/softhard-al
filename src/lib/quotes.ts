import { formatEuros } from "@/lib/format";
import type { QuoteStatus, ServiceStatus } from "@/generated/prisma/enums";

/**
 * Reglas de negocio de presupuestos. Se opera en céntimos para no arrastrar
 * errores de coma flotante en restas de importes.
 */

const MAX_IMPORTE = 999999.99;

/** Decisiones que puede tomar el cliente sobre un presupuesto. */
export const DECISIONES = ["aceptar", "rechazar"] as const;

export type Decision = (typeof DECISIONES)[number];

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

/**
 * Un presupuesto está vencido desde el mismo instante de su caducidad. Se
 * evalúa de forma perezosa: no hay cron en Fase 1.
 */
export function estaExpirado(expiresAt: Date, ahora: Date): boolean {
  return expiresAt.getTime() <= ahora.getTime();
}

/** Estados de solicitud en los que el cliente todavía puede decidir. */
const ESTADOS_SOLICITUD_DECISION: readonly ServiceStatus[] = [
  "pendiente",
  "diagnosticada",
];

/**
 * Única regla de decisión del cliente: presupuesto pendiente, no vencido y
 * solicitud aún abierta.
 */
export function puedeDecidir(
  estadoSolicitud: ServiceStatus,
  estadoPresupuesto: QuoteStatus,
  expiresAt: Date,
  ahora: Date,
): boolean {
  return (
    estadoPresupuesto === "pendiente" &&
    ESTADOS_SOLICITUD_DECISION.includes(estadoSolicitud) &&
    !estaExpirado(expiresAt, ahora)
  );
}

export type ResultadoDecision = {
  estadoSolicitud: "aceptada" | "rechazada";
  estadoPresupuesto: "aceptado" | "rechazado";
  importeFinal: number;
};

/**
 * Traduce una decisión a los estados e importe final que se guardan. El
 * importe se recalcula aquí: nunca se acepta un importe del formulario.
 */
export function resolverDecision(
  decision: Decision,
  presupuesto: number,
  tarifaDiagnostico: number,
): ResultadoDecision {
  if (decision === "aceptar") {
    return {
      estadoSolicitud: "aceptada",
      estadoPresupuesto: "aceptado",
      importeFinal: calcularImporteSiAcepta(presupuesto, tarifaDiagnostico),
    };
  }

  return {
    estadoSolicitud: "rechazada",
    estadoPresupuesto: "rechazado",
    importeFinal: calcularImporteSiRechaza(tarifaDiagnostico),
  };
}
