import type { Prisma } from "@/generated/prisma/client";
import type { EquipmentType, ServiceStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  ESTADOS_AVISO_PANEL,
  ESTADOS_AVISO_TRABAJADOR,
  HORAS_INACTIVIDAD_POR_DEFECTO,
  TOPE_AVISOS,
} from "@/lib/inactivity";
import { ESTADOS_FINALES } from "@/lib/service-status";

export type ReparacionAviso = {
  id: string;
  status: ServiceStatus;
  equipmentType: EquipmentType;
  brand: string;
  model: string;
  lastActivityAt: Date;
  assignee: { name: string } | null;
};

export type DevueltaSinResponsable = ReparacionAviso & {
  devolucion: { createdAt: Date; reason: string | null; fromAssignee: { name: string } | null } | null;
};

/** Lista con tope y total real, para mostrar "y N más". */
export type ListaAvisos<T> = { elementos: T[]; total: number };

const SELECT_AVISO = {
  id: true,
  status: true,
  equipmentType: true,
  brand: true,
  model: true,
  lastActivityAt: true,
  assignee: { select: { name: true } },
} satisfies Prisma.ServiceRequestSelect;

/**
 * Devuelta sin responsable: no final, sin responsable y con alguna devolución
 * en el historial (la única entrada con `toAssigneeId` nulo). Si el staff la
 * reasigna ya tiene responsable y deja de cumplirlo.
 */
const WHERE_DEVUELTA = {
  assigneeId: null,
  status: { notIn: [...ESTADOS_FINALES] },
  assignmentHistory: { some: { toAssigneeId: null } },
} satisfies Prisma.ServiceRequestWhereInput;

export async function obtenerHorasInactividad(): Promise<number> {
  const config = await prisma.config.findUnique({
    where: { id: 1 },
    select: { inactiveRequestHours: true },
  });

  return config?.inactiveRequestHours ?? HORAS_INACTIVIDAD_POR_DEFECTO;
}

/** Reparaciones del trabajador que superan el plazo, las más descuidadas primero. */
export async function listarMisReparacionesDescuidadas(
  userId: string,
  limite: Date,
): Promise<ListaAvisos<ReparacionAviso>> {
  const where = {
    assigneeId: userId,
    status: { in: [...ESTADOS_AVISO_TRABAJADOR] },
    lastActivityAt: { lt: limite },
  } satisfies Prisma.ServiceRequestWhereInput;

  const [elementos, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: { lastActivityAt: "asc" },
      take: TOPE_AVISOS,
      select: SELECT_AVISO,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return { elementos, total };
}

/**
 * Reparaciones del taller sin actividad, con o sin responsable, para el panel.
 * `tope` nulo devuelve la lista completa (página de reportes).
 */
export async function listarReparacionesSinActividad(
  limite: Date,
  tope: number | null = TOPE_AVISOS,
): Promise<ListaAvisos<ReparacionAviso>> {
  const where = {
    status: { in: [...ESTADOS_AVISO_PANEL] },
    lastActivityAt: { lt: limite },
  } satisfies Prisma.ServiceRequestWhereInput;

  const [elementos, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: { lastActivityAt: "asc" },
      ...(tope === null ? {} : { take: tope }),
      select: SELECT_AVISO,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return { elementos, total };
}

/** Devueltas por un trabajador y aún sin reasignar, con la última devolución. */
export async function listarDevueltasSinResponsable(
  tope: number | null = TOPE_AVISOS,
): Promise<ListaAvisos<DevueltaSinResponsable>> {
  const [filas, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: WHERE_DEVUELTA,
      orderBy: { lastActivityAt: "asc" },
      ...(tope === null ? {} : { take: tope }),
      select: {
        ...SELECT_AVISO,
        assignmentHistory: {
          where: { toAssigneeId: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            createdAt: true,
            reason: true,
            fromAssignee: { select: { name: true } },
          },
        },
      },
    }),
    prisma.serviceRequest.count({ where: WHERE_DEVUELTA }),
  ]);

  return {
    elementos: filas.map(({ assignmentHistory, ...fila }) => ({
      ...fila,
      devolucion: assignmentHistory[0] ?? null,
    })),
    total,
  };
}
