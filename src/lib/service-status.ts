import type { ServiceStatus } from "@/generated/prisma/enums";
import { SERVICE_STATUSES } from "@/lib/service-requests";

/** Roles que pueden intervenir en una transición de estado. */
export type RolTaller = "trabajador" | "encargado" | "admin";

export type MotivoTransicionInvalida =
  | "mismo-estado"
  | "sin-presupuesto"
  | "no-asignada"
  | "transicion-invalida"
  | "motivo-obligatorio";

export type EvaluacionTransicion =
  | { permitida: true; requiereMotivo: boolean }
  | { permitida: false; motivo: MotivoTransicionInvalida };

export type ContextoTransicion = {
  actual: ServiceStatus;
  rol: RolTaller;
  asignadaAlTrabajador: boolean;
  tienePresupuesto: boolean;
};

export type ContextoEvaluacionTransicion = ContextoTransicion & {
  nuevo: ServiceStatus;
  motivo?: string | null;
};

export type OpcionTransicion = {
  estado: ServiceStatus;
  requiereMotivo: boolean;
};

/**
 * Flujo normal por rol. Lo que no está aquí solo puede hacerlo encargado/admin
 * como corrección, con motivo obligatorio.
 *
 * El trabajador marca `lista` únicamente desde `en_reparacion`; si está
 * esperando repuesto, primero debe volver a reparación.
 */
const FLUJO_TRABAJADOR: Record<ServiceStatus, readonly ServiceStatus[]> = {
  pendiente: [],
  diagnosticada: [],
  aceptada: ["en_reparacion"],
  rechazada: [],
  expirada: [],
  en_reparacion: ["esperando_repuesto", "lista"],
  esperando_repuesto: ["en_reparacion"],
  lista: [],
  entregada: [],
};

const FLUJO_STAFF: Record<ServiceStatus, readonly ServiceStatus[]> = {
  ...FLUJO_TRABAJADOR,
  lista: ["entregada"],
};

/** Tabla explícita del flujo normal por rol. */
export const TRANSICIONES_NORMALES: Record<
  RolTaller,
  Record<ServiceStatus, readonly ServiceStatus[]>
> = {
  trabajador: FLUJO_TRABAJADOR,
  encargado: FLUJO_STAFF,
  admin: FLUJO_STAFF,
};

/**
 * Estados finales: no admiten asignación, reasignación ni devolución.
 */
export const ESTADOS_FINALES = [
  "entregada",
  "rechazada",
  "expirada",
] as const satisfies readonly ServiceStatus[];

export function esEstadoFinal(estado: ServiceStatus): boolean {
  return (ESTADOS_FINALES as readonly ServiceStatus[]).includes(estado);
}

/**
 * Estados que implican una decisión sobre el presupuesto: sin presupuesto no
 * hay importe que aceptar ni rechazar.
 */
const ESTADOS_CON_PRESUPUESTO: readonly ServiceStatus[] = ["aceptada", "rechazada"];

export function necesitaPresupuesto(estado: ServiceStatus): boolean {
  return ESTADOS_CON_PRESUPUESTO.includes(estado);
}

function evaluarBase(
  contexto: ContextoTransicion & { nuevo: ServiceStatus },
): EvaluacionTransicion {
  const { actual, nuevo, rol, asignadaAlTrabajador, tienePresupuesto } = contexto;

  if (actual === nuevo) {
    return { permitida: false, motivo: "mismo-estado" };
  }

  if (necesitaPresupuesto(nuevo) && !tienePresupuesto) {
    return { permitida: false, motivo: "sin-presupuesto" };
  }

  if (rol === "trabajador") {
    if (!asignadaAlTrabajador) {
      return { permitida: false, motivo: "no-asignada" };
    }

    return TRANSICIONES_NORMALES.trabajador[actual].includes(nuevo)
      ? { permitida: true, requiereMotivo: false }
      : { permitida: false, motivo: "transicion-invalida" };
  }

  return TRANSICIONES_NORMALES[rol][actual].includes(nuevo)
    ? { permitida: true, requiereMotivo: false }
    : { permitida: true, requiereMotivo: true };
}

/**
 * Única regla para decidir si un cambio de estado es válido. Las correcciones
 * del staff fuera del flujo normal exigen motivo.
 */
export function evaluarCambioEstado(
  contexto: ContextoEvaluacionTransicion,
): EvaluacionTransicion {
  const evaluacion = evaluarBase(contexto);

  if (!evaluacion.permitida) {
    return evaluacion;
  }

  if (evaluacion.requiereMotivo && !contexto.motivo?.trim()) {
    return { permitida: false, motivo: "motivo-obligatorio" };
  }

  return evaluacion;
}

/** Opciones válidas para el select, con la información de si exigen motivo. */
export function opcionesCambioEstado(
  contexto: ContextoTransicion,
): OpcionTransicion[] {
  const normales: OpcionTransicion[] = [];
  const correcciones: OpcionTransicion[] = [];

  for (const nuevo of SERVICE_STATUSES) {
    const evaluacion = evaluarBase({ ...contexto, nuevo });

    if (!evaluacion.permitida) {
      continue;
    }

    const opcion = {
      estado: nuevo,
      requiereMotivo: evaluacion.requiereMotivo,
    };

    if (evaluacion.requiereMotivo) {
      correcciones.push(opcion);
    } else {
      normales.push(opcion);
    }
  }

  // El flujo normal va primero: es la acción esperada en el uso diario.
  return [...normales, ...correcciones];
}

/** Lista simple de estados válidos para una transición. */
export function estadosDisponibles(contexto: ContextoTransicion): ServiceStatus[] {
  return opcionesCambioEstado(contexto).map((opcion) => opcion.estado);
}
