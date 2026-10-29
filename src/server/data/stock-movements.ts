import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

type DatosStockInicial = {
  productId: string;
  stock: number;
  userId?: string | null;
  note?: string | null;
};

/**
 * Registra el saldo inicial de un producto. La variación debe ser positiva:
 * un producto con stock 0 no genera movimiento y su suma vacía ya es 0.
 */
export async function crearMovimientoStockInicial(
  tx: Tx,
  { productId, stock, userId = null, note = null }: DatosStockInicial,
): Promise<void> {
  if (stock <= 0) {
    return;
  }

  await tx.stockMovement.create({
    data: {
      productId,
      variation: stock,
      reason: "stock_inicial",
      userId,
      note,
    },
  });
}

/**
 * Un movimiento de caducidad por línea, con variación positiva, ligado al
 * pedido y sin usuario (lo hace el sistema).
 */
export async function crearMovimientosCaducidad(
  tx: Tx,
  orderId: string,
  lineas: readonly { productId: string; quantity: number }[],
): Promise<void> {
  if (lineas.length === 0) {
    return;
  }

  await tx.stockMovement.createMany({
    data: lineas.map((linea) => ({
      productId: linea.productId,
      variation: linea.quantity,
      reason: "caducidad_pedido" as const,
      orderId,
    })),
  });
}

/** Un movimiento de venta por línea, con variación negativa y ligado al pedido. */
export async function crearMovimientosVenta(
  tx: Tx,
  orderId: string,
  lineas: readonly { productId: string; quantity: number }[],
): Promise<void> {
  if (lineas.length === 0) {
    return;
  }

  await tx.stockMovement.createMany({
    data: lineas.map((linea) => ({
      productId: linea.productId,
      variation: -linea.quantity,
      reason: "venta" as const,
      orderId,
    })),
  });
}
