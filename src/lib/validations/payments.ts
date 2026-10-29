import { z } from "zod";

import { MAX_NOTA_COBRO, METODOS_PAGO_MANUAL } from "@/lib/payments";

/**
 * Importe con hasta 6 dígitos enteros y 2 decimales. Admite coma española o
 * punto, igual que el presupuesto y el precio de producto.
 */
const IMPORTE_REGEX = /^\d{1,6}(?:[.,]\d{1,2})?$/;

export const ENTIDADES_COBRO = ["pedido", "solicitud"] as const;

export const registrarCobroSchema = z.object({
  entidad: z.enum(ENTIDADES_COBRO, { error: "Cobro no válido" }),
  id: z.string().trim().min(1, "Cobro no válido"),
  importe: z
    .string()
    .trim()
    .min(1, "Indica el importe cobrado")
    .regex(IMPORTE_REGEX, "Usa un importe válido, por ejemplo 120,50")
    .transform((valor) => Number(valor.replace(",", ".")))
    .refine((valor) => valor > 0, "El importe debe ser mayor que 0"),
  metodo: z.enum(METODOS_PAGO_MANUAL, { error: "Elige cómo se ha cobrado" }),
  nota: z
    .string()
    .trim()
    .max(MAX_NOTA_COBRO, `La nota no puede superar los ${MAX_NOTA_COBRO} caracteres`)
    .transform((valor) => (valor === "" ? null : valor)),
});

export type RegistrarCobroInput = z.infer<typeof registrarCobroSchema>;
