import { z } from "zod";

import {
  MAX_STOCK_NOTE_LENGTH,
  MAX_STOCK_VARIATION,
  MOTIVOS_AJUSTE_STOCK,
} from "@/lib/stock";
import { productIdSchema } from "@/lib/validations/product";

const variationSchema = z
  .string()
  .trim()
  .min(1, "Indica la variación")
  .regex(/^-?\d+$/, "La variación debe ser un número entero")
  .transform(Number)
  .refine((value) => value !== 0, "La variación no puede ser cero")
  .refine(
    (value) => Math.abs(value) <= MAX_STOCK_VARIATION,
    `La variación no puede superar ${MAX_STOCK_VARIATION} unidades`,
  );

export const stockAdjustmentSchema = z
  .object({
    productId: productIdSchema,
    reason: z.enum(MOTIVOS_AJUSTE_STOCK, {
      error: "Selecciona un motivo",
    }),
    variation: variationSchema,
    note: z
      .string()
      .trim()
      .max(
        MAX_STOCK_NOTE_LENGTH,
        `La nota no puede superar ${MAX_STOCK_NOTE_LENGTH} caracteres`,
      )
      .transform((value) => (value === "" ? null : value)),
  })
  .superRefine((value, ctx) => {
    if (value.reason === "reposicion" && value.variation < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["variation"],
        message: "Una reposición debe ser positiva",
      });
    }

    if (value.reason === "ajuste" && value.note === null) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "La nota es obligatoria para un ajuste",
      });
    }
  });

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
