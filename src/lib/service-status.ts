import type { ServiceStatus } from "@/generated/prisma/enums";

/**
 * Estados que implican una decisión sobre el presupuesto: sin presupuesto no
 * hay importe que aceptar ni rechazar.
 */
const ESTADOS_CON_PRESUPUESTO: readonly ServiceStatus[] = ["aceptada", "rechazada"];

export function necesitaPresupuesto(estado: ServiceStatus): boolean {
  return ESTADOS_CON_PRESUPUESTO.includes(estado);
}

/**
 * Regla única para el cambio manual de estado. El encargado puede corregir
 * cualquier estado, pero no marcar aceptada/rechazada sin presupuesto ni
 * "cambiar" al mismo estado.
 */
export function puedeCambiarEstado(
  actual: ServiceStatus,
  nuevo: ServiceStatus,
  tienePresupuesto: boolean,
): boolean {
  if (actual === nuevo) {
    return false;
  }

  if (necesitaPresupuesto(nuevo) && !tienePresupuesto) {
    return false;
  }

  return true;
}
