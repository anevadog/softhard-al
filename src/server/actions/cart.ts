"use server";

import type { ProductoPublico } from "@/lib/products";
import { cartIdsSchema } from "@/lib/validations/cart";
import { liberarPedidosCaducadosSinFallar } from "@/server/data/orders";
import { listarProductosPorIds } from "@/server/data/products";

/**
 * Lectura pública del carrito: el navegador solo guarda IDs y cantidades,
 * así que los precios y el stock se consultan aquí, en el servidor.
 */
export async function obtenerProductosCarritoAction(
  ids: string[],
): Promise<ProductoPublico[]> {
  const parsed = cartIdsSchema.safeParse(ids);

  if (!parsed.success) {
    return [];
  }

  // El carrito muestra el stock real: lo retenido por pedidos vencidos se libera antes.
  await liberarPedidosCaducadosSinFallar();

  return listarProductosPorIds(parsed.data);
}
