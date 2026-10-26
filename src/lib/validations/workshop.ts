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
