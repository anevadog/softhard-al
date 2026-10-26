import { z } from "zod";

import { PRODUCT_CATEGORIES } from "@/lib/products";

/**
 * El precio llega como texto del formulario. Se admiten coma o punto y hasta
 * dos decimales. El tope de 6 enteros deja margen bajo el `Decimal(10,2)`.
 */
const PRICE_REGEX = /^\d{1,6}(?:[.,]\d{1,2})?$/;
const MAX_PRICE = 999999.99;
const MAX_STOCK = 999999;
const MAX_IMAGE_URL_LENGTH = 500;

function esUrlHttp(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const productBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede superar los 80 caracteres"),
  description: z
    .string()
    .trim()
    .min(10, "La descripción debe tener al menos 10 caracteres")
    .max(2000, "La descripción no puede superar los 2000 caracteres"),
  price: z
    .string()
    .trim()
    .min(1, "Indica el precio del producto")
    .regex(PRICE_REGEX, "Usa un precio válido, por ejemplo 49,90")
    .transform((value) => Number(value.replace(",", ".")))
    .refine((value) => value > 0, "El precio debe ser mayor que 0")
    .refine(
      (value) => value <= MAX_PRICE,
      `El precio no puede superar ${MAX_PRICE.toFixed(2)} €`,
    ),
  category: z.enum(PRODUCT_CATEGORIES, {
    error: "Selecciona una categoría",
  }),
  imageUrl: z
    .string()
    .trim()
    .max(MAX_IMAGE_URL_LENGTH, "La URL de la imagen es demasiado larga")
    .refine(
      (value) => value === "" || esUrlHttp(value),
      "Usa una URL válida que empiece por http:// o https://",
    )
    .transform((value) => (value === "" ? null : value)),
});

/**
 * El stock solo se fija en el alta. A partir de ahí cambia por movimientos
 * (ventas, cancelaciones, reposiciones y ajustes), no por una edición normal.
 */
export const productCreateSchema = productBaseSchema.extend({
  stock: z
    .string()
    .trim()
    .min(1, "Indica el stock disponible")
    .regex(/^\d+$/, "El stock debe ser un número entero")
    .transform(Number)
    .refine(
      (value) => value <= MAX_STOCK,
      `El stock no puede superar ${MAX_STOCK} unidades`,
    ),
});

/** Zod descarta cualquier `stock` inyectado en el formulario de edición. */
export const productEditSchema = productBaseSchema;

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductEditInput = z.infer<typeof productEditSchema>;

export const productIdSchema = z
  .string()
  .trim()
  .min(1, "Producto no válido")
  .max(64, "Producto no válido");
