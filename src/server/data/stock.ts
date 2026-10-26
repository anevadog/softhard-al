import type { StockMovementReason } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { MotivoAjusteStock } from "@/lib/stock";

export type DatosAjusteStock = {
  productId: string;
  variation: number;
  reason: MotivoAjusteStock;
  note: string | null;
  userId: string;
};

export type ResultadoAjusteStock =
  | { ok: true }
  | { ok: false; motivo: "no-disponible" | "stock-insuficiente" };

/**
 * Aplica un movimiento manual y actualiza el stock en la misma transacción.
 *
 * La condición `stock >= |variación|` se evalúa de forma atómica con el
 * incremento: si otra operación deja el stock por debajo, no se actualiza ni se
 * registra el movimiento. Los productos archivados no admiten ajustes manuales.
 */
export async function ajustarStockProducto(
  datos: DatosAjusteStock,
): Promise<ResultadoAjusteStock> {
  return prisma.$transaction(async (tx) => {
    const stockMinimo = datos.variation < 0 ? -datos.variation : 0;

    const actualizado = await tx.product.updateMany({
      where: {
        id: datos.productId,
        active: true,
        stock: { gte: stockMinimo },
      },
      data: { stock: { increment: datos.variation } },
    });

    if (actualizado.count === 0) {
      const producto = await tx.product.findFirst({
        where: { id: datos.productId, active: true },
        select: { id: true },
      });

      return {
        ok: false as const,
        motivo: producto ? ("stock-insuficiente" as const) : ("no-disponible" as const),
      };
    }

    await tx.stockMovement.create({
      data: {
        productId: datos.productId,
        variation: datos.variation,
        reason: datos.reason,
        note: datos.note,
        userId: datos.userId,
      },
    });

    return { ok: true as const };
  });
}

export type MovimientoStockAdmin = {
  id: string;
  createdAt: Date;
  reason: StockMovementReason;
  variation: number;
  note: string | null;
  user: { name: string } | null;
  orderId: string | null;
};

/** Últimos movimientos de un producto para la ficha del panel. */
export async function listarMovimientosProducto(
  productId: string,
  limit = 10,
): Promise<MovimientoStockAdmin[]> {
  return prisma.stockMovement.findMany({
    where: { productId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      createdAt: true,
      reason: true,
      variation: true,
      note: true,
      user: { select: { name: true } },
      orderId: true,
    },
  });
}
