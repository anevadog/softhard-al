import { prisma } from "@/lib/db";
import type { SolicitudResumen } from "@/lib/service-requests";
import type { ServiceRequestInput } from "@/lib/validations/service-request";

/**
 * Capa de datos de solicitudes. Las acciones y páginas no tocan Prisma
 * directamente: así los permisos y el filtrado por cliente quedan en un sitio.
 */

export async function crearSolicitudCliente(
  clientId: string,
  input: ServiceRequestInput,
): Promise<{ id: string }> {
  return prisma.serviceRequest.create({
    data: {
      clientId,
      equipmentType: input.equipmentType,
      brand: input.brand,
      model: input.model,
      issue: input.issue,
      modality: input.modality,
      timeSlot: input.timeSlot,
    },
    select: { id: true },
  });
}

export async function listarSolicitudesCliente(clientId: string): Promise<SolicitudResumen[]> {
  return prisma.serviceRequest.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      equipmentType: true,
      brand: true,
      model: true,
      issue: true,
      modality: true,
      timeSlot: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function contarSolicitudesCliente(clientId: string): Promise<number> {
  return prisma.serviceRequest.count({ where: { clientId } });
}
