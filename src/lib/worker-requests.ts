import type {
  EquipmentType,
  Modality,
  ServiceStatus,
  TimeSlot,
} from "@/generated/prisma/enums";
import { opcionesCambioEstado } from "@/lib/service-status";

/**
 * Estados que aparecen en "Mis reparaciones", en orden de pantalla. Primero
 * los que exigen acción del trabajador; `lista` queda al final a la espera de
 * que el encargado marque la entrega.
 */
export const ESTADOS_MIS_REPARACIONES = [
  "aceptada",
  "en_reparacion",
  "esperando_repuesto",
  "lista",
] as const satisfies readonly ServiceStatus[];

const ESTADOS_CON_ACCION: readonly ServiceStatus[] = [
  "aceptada",
  "en_reparacion",
  "esperando_repuesto",
];

/** Fila de las listas del taller. Nunca incluye datos de contacto del cliente. */
export type ReparacionTallerResumen = {
  id: string;
  status: ServiceStatus;
  equipmentType: EquipmentType;
  brand: string;
  model: string;
  issue: string;
  modality: Modality;
  lastActivityAt: Date;
  createdAt: Date;
};

export type EstadoHistorialTaller = {
  id: string;
  createdAt: Date;
  fromStatus: ServiceStatus;
  toStatus: ServiceStatus;
  changedBy: { name: string } | null;
  reason: string | null;
};

export type AsignacionHistorialTaller = {
  id: string;
  createdAt: Date;
  fromAssignee: { name: string } | null;
  toAssignee: { name: string } | null;
  changedBy: { name: string } | null;
  reason: string | null;
};

type ReparacionTallerBase = ReparacionTallerResumen & {
  timeSlot: TimeSlot;
  preferredDate: Date | null;
};

/**
 * Detalle visible para el trabajador. `esMia` distingue sus reparaciones de las
 * aceptadas sin responsable, que solo puede consultar y tomar: de esas no hay
 * historiales ni nombre del cliente.
 */
export type ReparacionTallerDetalle =
  | (ReparacionTallerBase & {
      esMia: true;
      clientName: string;
      statusHistory: EstadoHistorialTaller[];
      assignmentHistory: AsignacionHistorialTaller[];
    })
  | (ReparacionTallerBase & { esMia: false });

export type GrupoReparaciones<T> = {
  estado: ServiceStatus;
  requiereAccion: boolean;
  reparaciones: T[];
};

/**
 * Agrupa por estado en el orden de `ESTADOS_MIS_REPARACIONES`, conservando el
 * orden recibido dentro de cada grupo. Omite grupos vacíos y estados ajenos a
 * la lista.
 */
export function agruparPorEstado<T extends { status: ServiceStatus }>(
  reparaciones: readonly T[],
): GrupoReparaciones<T>[] {
  return ESTADOS_MIS_REPARACIONES.map((estado) => ({
    estado,
    requiereAccion: ESTADOS_CON_ACCION.includes(estado),
    reparaciones: reparaciones.filter((reparacion) => reparacion.status === estado),
  })).filter((grupo) => grupo.reparaciones.length > 0);
}

export type AccionEstadoTrabajador = {
  estado: ServiceStatus;
  etiqueta: string;
};

function etiquetaAccion(actual: ServiceStatus, nuevo: ServiceStatus): string {
  if (nuevo === "en_reparacion") {
    return actual === "esperando_repuesto" ? "Volver a reparación" : "Iniciar reparación";
  }

  if (nuevo === "esperando_repuesto") {
    return "Esperando repuesto";
  }

  if (nuevo === "lista") {
    return "Marcar lista";
  }

  return nuevo;
}

/**
 * Botones de cambio de estado del trabajador asignado. Sale de la misma
 * función de transiciones que valida el servidor y descarta cualquier opción
 * que exija motivo: el trabajador nunca corrige estados.
 */
export function accionesEstadoTrabajador(
  actual: ServiceStatus,
): AccionEstadoTrabajador[] {
  return opcionesCambioEstado({
    actual,
    rol: "trabajador",
    asignadaAlTrabajador: true,
    // El trabajador nunca mueve a aceptada ni rechazada, así que el
    // presupuesto no cambia sus opciones.
    tienePresupuesto: true,
  })
    .filter((opcion) => !opcion.requiereMotivo)
    .map((opcion) => ({
      estado: opcion.estado,
      etiqueta: etiquetaAccion(actual, opcion.estado),
    }));
}
