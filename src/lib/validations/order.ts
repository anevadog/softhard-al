import { z } from "zod";

import {
  MAX_CART_ITEMS,
  MAX_CART_QUANTITY,
  MAX_PRODUCT_ID_LENGTH,
} from "@/lib/cart";
import { ORDER_STATUSES } from "@/lib/orders";

export const checkoutItemSchema = z.object({
  productId: z
    .string()
    .trim()
    .min(1, "Producto no válido")
    .max(MAX_PRODUCT_ID_LENGTH, "Producto no válido"),
  quantity: z
    .number({ error: "Cantidad no válida" })
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad debe ser al menos 1")
    .max(MAX_CART_QUANTITY, "La cantidad es demasiado alta"),
});

export const checkoutSchema = z
  .object({
    items: z
      .array(checkoutItemSchema)
      .min(1, "El carrito está vacío")
      .max(MAX_CART_ITEMS, "El carrito contiene demasiados productos")
      .superRefine((items, ctx) => {
        const vistos = new Set<string>();

        items.forEach((item, index) => {
          if (vistos.has(item.productId)) {
            ctx.addIssue({
              code: "custom",
              path: [index, "productId"],
              message: "Producto duplicado en el carrito",
            });
          }

          vistos.add(item.productId);
        });
      }),
    idempotencyKey: z
      .string()
      .trim()
      .uuid("La clave de idempotencia no es válida"),
  })
  .transform((data) => ({
    items: data.items.map((item) => ({
      ...item,
      productId: item.productId.trim(),
    })),
    idempotencyKey: data.idempotencyKey.trim(),
  }));

export type CheckoutInput = z.infer<typeof checkoutSchema>;

const MAX_CANCELLATION_REASON_LENGTH = 500;

export const orderIdSchema = z
  .string()
  .trim()
  .min(1, "Pedido no válido")
  .max(64, "Pedido no válido");

export const cambiarEstadoPedidoSchema = z
  .object({
    orderId: orderIdSchema,
    estadoEsperado: z.enum(ORDER_STATUSES, { error: "Estado no válido" }),
    estadoNuevo: z.enum(ORDER_STATUSES, { error: "Estado no válido" }),
    motivo: z
      .string()
      .trim()
      .max(
        MAX_CANCELLATION_REASON_LENGTH,
        `El motivo no puede superar ${MAX_CANCELLATION_REASON_LENGTH} caracteres`,
      )
      .transform((value) => (value === "" ? null : value)),
  })
  .superRefine((value, ctx) => {
    if (
      value.estadoEsperado === "pagado" &&
      value.estadoNuevo === "cancelado" &&
      value.motivo === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["motivo"],
        message: "Indica el motivo de la cancelación",
      });
    }
  });

export type CambiarEstadoPedidoInput = z.infer<
  typeof cambiarEstadoPedidoSchema
>;
