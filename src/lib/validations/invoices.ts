import { z } from "zod";

import {
  MAX_MOTIVO_RECTIFICATIVA,
  MAX_MOTIVO_REEMISION,
  MIN_MOTIVO_RECTIFICATIVA,
  MIN_MOTIVO_REEMISION,
} from "@/lib/invoices";
import { esNifValido, normalizarNif } from "@/lib/nif";

export const rectificativaSchema = z.object({
  invoiceId: z.string().trim().min(1, "Factura no válida"),
  motivo: z
    .string()
    .trim()
    .min(
      MIN_MOTIVO_RECTIFICATIVA,
      `Explica el motivo (mínimo ${MIN_MOTIVO_RECTIFICATIVA} caracteres)`,
    )
    .max(MAX_MOTIVO_RECTIFICATIVA, `Máximo ${MAX_MOTIVO_RECTIFICATIVA} caracteres`),
});

export const reemisionSchema = z.object({
  entidad: z.enum(["pedido", "solicitud"], { error: "Factura no válida" }),
  id: z.string().trim().min(1, "Factura no válida"),
  motivo: z
    .string()
    .trim()
    .min(MIN_MOTIVO_REEMISION, `Explica el motivo (mínimo ${MIN_MOTIVO_REEMISION} caracteres)`)
    .max(MAX_MOTIVO_REEMISION, `Máximo ${MAX_MOTIVO_REEMISION} caracteres`),
});

/** NIF opcional: vacío lo borra; si hay valor, se normaliza y se valida. */
export const nifSchema = z.object({
  nif: z
    .string()
    .max(20, "NIF no válido")
    .transform((valor) => normalizarNif(valor))
    .refine((valor) => valor === "" || esNifValido(valor), "Revisa el NIF: DNI, NIE o CIF")
    .transform((valor) => (valor === "" ? null : valor)),
});
