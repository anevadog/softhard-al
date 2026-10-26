import type { Prisma } from "@/generated/prisma/client";
import type { ProductCategory } from "@/generated/prisma/enums";

import { crearMovimientoStockInicial } from "./stock-movements";

type Tx = Prisma.TransactionClient;

export type ProductoSeed = {
  id: string;
  name: string;
  description: string;
  price: string;
  stock: number;
  imageUrl: string | null;
  category: ProductCategory;
};

/**
 * Crea un producto demo solo si no existía. El stock_inicial se registra
 * únicamente en ese alta y con el stock definido en los datos demo, nunca con
 * el stock leído de la base. Si el producto ya existía no se toca ni se
 * completa su libro: podría haber cambiado por ventas o reposiciones.
 */
export async function crearProductoSeedSiNoExiste(
  tx: Tx,
  producto: ProductoSeed,
): Promise<boolean> {
  const existente = await tx.product.findUnique({
    where: { id: producto.id },
    select: { id: true },
  });

  if (existente) {
    return false;
  }

  await tx.product.create({ data: producto });

  await crearMovimientoStockInicial(tx, {
    productId: producto.id,
    stock: producto.stock,
    note: "Stock inicial del seed",
  });

  return true;
}
