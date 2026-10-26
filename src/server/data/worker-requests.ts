import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  ESTADOS_MIS_REPARACIONES,
  type ReparacionTallerDetalle,
  type ReparacionTallerResumen,
} from "@/lib/worker-requests";

/** Tope de la lista "Para tomar": el taller no debería acumular más. */
export const LIMITE_PARA_TOMAR = 50;

const SELECT_RESUMEN = {
  id: true,
  status: true,
  equipmentType: true,
  brand: true,
  model: true,
  issue: true,
  modality: true,
  lastActivityAt: true,
  createdAt: true,
} satisfies Prisma.ServiceRequestSelect;

/**
 * Reparaciones abiertas del trabajador. El filtro por responsable va en la
 * consulta: nunca se cargan reparaciones ajenas para filtrarlas en memoria.
 * Las más descuidadas primero.
 */
export async function listarMisReparaciones(
  userId: string,
): Promise<ReparacionTallerResumen[]> {
  return prisma.serviceRequest.findMany({
    where: {
      assigneeId: userId,
      status: { in: [...ESTADOS_MIS_REPARACIONES] },
    },
    orderBy: { lastActivityAt: "asc" },
    select: SELECT_RESUMEN,
  });
}

/** Reparaciones aceptadas sin responsable que cualquier trabajador puede tomar. */
export async function listarReparacionesParaTomar(): Promise<
  ReparacionTallerResumen[]
> {
  return prisma.serviceRequest.findMany({
    where: { status: "aceptada", assigneeId: null },
    orderBy: { lastActivityAt: "asc" },
    take: LIMITE_PARA_TOMAR,
    select: SELECT_RESUMEN,
  });
}

const SELECT_DETALLE_BASE = {
  ...SELECT_RESUMEN,
  timeSlot: true,
  preferredDate: true,
} satisfies Prisma.ServiceRequestSelect;

/**
 * Detalle para el trabajador: solo si es suya o está aceptada y sin
 * responsable. Una reparación ajena y una inexistente devuelven lo mismo
 * (`null`), así que la página no revela si existe. Email y teléfono del
 * cliente no se seleccionan nunca.
 *
 * Cada caso tiene su propia consulta: los historiales y el nombre del
 * cliente solo se leen cuando la reparación es del trabajador. De una libre
 * solo se lee lo necesario para decidir si tomarla.
 */
export async function obtenerReparacionTrabajador(
  id: string,
  userId: string,
): Promise<ReparacionTallerDetalle | null> {
  const propia = await prisma.serviceRequest.findFirst({
    where: { id, assigneeId: userId },
    select: {
      ...SELECT_DETALLE_BASE,
      client: { select: { name: true } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          changedBy: { select: { name: true } },
        },
      },
      assignmentHistory: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          reason: true,
          fromAssignee: { select: { name: true } },
          toAssignee: { select: { name: true } },
          changedBy: { select: { name: true } },
        },
      },
    },
  });

  if (propia) {
    const { client, ...resto } = propia;

    return { ...resto, esMia: true, clientName: client.name };
  }

  const libre = await prisma.serviceRequest.findFirst({
    where: { id, status: "aceptada", assigneeId: null },
    select: SELECT_DETALLE_BASE,
  });

  return libre ? { ...libre, esMia: false } : null;
}
