import { z } from "zod";

import { MAX_CART_ITEMS } from "@/lib/cart";

const MAX_PRODUCT_ID_LENGTH = 100;

export const cartIdsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Producto no válido")
      .max(MAX_PRODUCT_ID_LENGTH, "Producto no válido"),
  )
  .max(MAX_CART_ITEMS, "El carrito contiene demasiados productos")
  .transform((ids) => Array.from(new Set(ids)));
