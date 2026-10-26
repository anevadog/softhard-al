import { z } from "zod";

import { SERVICE_STATUSES } from "@/lib/service-requests";

export const cambioEstadoSchema = z.object({
  requestId: z.string().trim().min(1, "Solicitud no válida"),
  estadoEsperado: z.enum(SERVICE_STATUSES, { error: "Estado no válido" }),
  estadoNuevo: z.enum(SERVICE_STATUSES, { error: "Estado no válido" }),
  motivo: z
    .string()
    .trim()
    .max(500, "El motivo no puede superar los 500 caracteres")
    .optional()
    .default(""),
});

export type CambioEstadoInput = z.infer<typeof cambioEstadoSchema>;

const motivoOpcional = z
  .string()
  .trim()
  .max(500, "El motivo no puede superar los 500 caracteres")
  .optional()
  .default("");

export const asignacionSchema = z.object({
  requestId: z.string().trim().min(1, "Solicitud no válida"),
  assigneeId: z.string().trim().min(1, "Selecciona un trabajador"),
  assigneeEsperadoId: z
    .string()
    .trim()
    .optional()
    .default(""),
  motivo: motivoOpcional,
});

export type AsignacionInput = z.infer<typeof asignacionSchema>;

export const tomaSolicitudSchema = z.object({
  requestId: z.string().trim().min(1, "Solicitud no válida"),
});

export type TomaSolicitudInput = z.infer<typeof tomaSolicitudSchema>;

export const devolucionSolicitudSchema = z.object({
  requestId: z.string().trim().min(1, "Solicitud no válida"),
  motivo: z
    .string()
    .trim()
    .min(1, "Indica el motivo de la devolución")
    .max(500, "El motivo no puede superar los 500 caracteres"),
});

export type DevolucionSolicitudInput = z.infer<
  typeof devolucionSolicitudSchema
>;
