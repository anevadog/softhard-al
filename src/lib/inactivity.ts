import type { ServiceStatus } from "@/generated/prisma/enums";

/**
 * Avisos de reparaciones sin actividad, evaluados al leer (sin cron). Una
 * reparación está descuidada cuando su última actividad es estrictamente
 * anterior a `ahora − horas`.
 */

const MS_HORA = 3_600_000;

/** Valor por defecto si la fila de configuración no existe todavía. */
export const HORAS_INACTIVIDAD_POR_DEFECTO = 48;

/**
 * Estados que cuentan para el aviso del trabajador. `lista` queda fuera: la
 * entrega depende del encargado y la ve en su panel.
 */
export const ESTADOS_AVISO_TRABAJADOR = [
  "aceptada",
  "en_reparacion",
  "esperando_repuesto",
] as const satisfies readonly ServiceStatus[];

/** Estados del taller que el encargado vigila por falta de actividad. */
export const ESTADOS_AVISO_PANEL = [
  "aceptada",
  "en_reparacion",
  "esperando_repuesto",
  "lista",
] as const satisfies readonly ServiceStatus[];

/** Tope de elementos de cada lista de avisos; el resto se resume como "y N más". */
export const TOPE_AVISOS = 20;

export function limiteInactividad(ahora: Date, horas: number): Date {
  return new Date(ahora.getTime() - horas * MS_HORA);
}

export function estaDescuidada(lastActivityAt: Date, horas: number, ahora: Date): boolean {
  return lastActivityAt < limiteInactividad(ahora, horas);
}

/** Horas completas desde la última actividad (nunca negativas). */
export function horasSinActividad(lastActivityAt: Date, ahora: Date): number {
  return Math.max(0, Math.floor((ahora.getTime() - lastActivityAt.getTime()) / MS_HORA));
}

/** "hace 52 h" por debajo de 72 horas; "hace 3 días" a partir de ahí. */
export function describirInactividad(lastActivityAt: Date, ahora: Date): string {
  const horas = horasSinActividad(lastActivityAt, ahora);

  if (horas < 72) {
    return `hace ${horas} h`;
  }

  return `hace ${Math.floor(horas / 24)} días`;
}
