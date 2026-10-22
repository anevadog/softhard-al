import { z } from "zod";

import { DECISIONES } from "@/lib/quotes";
import { SERVICE_STATUSES } from "@/lib/service-requests";

/**
 * Importe con hasta 6 dígitos enteros y 2 decimales. Admite coma española o
 * punto. El tope de 6 enteros deja margen bajo el `Decimal(10,2)` de la BD.
 */
const IMPORTE_REGEX = /^\d{1,6}(?:[.,]\d{1,2})?$/;

export const quoteSchema = z.object({
  requestId: z.string().trim().min(1, "Solicitud no válida"),
  budgetAmount: z
    .string()
    .trim()
    .min(1, "Indica el importe del presupuesto")
    .regex(IMPORTE_REGEX, "Usa un importe válido, por ejemplo 120,50")
    .transform((valor) => Number(valor.replace(",", ".")))
    .refine((valor) => valor > 0, "El importe debe ser mayor que 0"),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

export const estadoSolicitudSchema = z.object({
  requestId: z.string().trim().min(1, "Solicitud no válida"),
  status: z.enum(SERVICE_STATUSES, { error: "Estado no válido" }),
});

export type EstadoSolicitudInput = z.infer<typeof estadoSolicitudSchema>;

export const decisionSchema = z.object({
  requestId: z.string().trim().min(1, "Solicitud no válida"),
  decision: z.enum(DECISIONES, { error: "Decisión no válida" }),
});

export type DecisionInput = z.infer<typeof decisionSchema>;
