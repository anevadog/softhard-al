-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('stock_inicial', 'venta', 'cancelacion_pedido', 'reposicion', 'ajuste');

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variation" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_orderId_idx" ON "stock_movements"("orderId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variation_nonzero" CHECK ("variation" <> 0);

-- CheckConstraint: el signo debe ser coherente con el motivo.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variation_sign" CHECK (
    ("reason" = 'venta' AND "variation" < 0)
    OR ("reason" IN ('stock_inicial', 'reposicion', 'cancelacion_pedido') AND "variation" > 0)
    OR ("reason" = 'ajuste' AND "variation" <> 0)
);

-- Backfill: un stock_inicial por cada producto existente con stock > 0.
-- Incluye productos archivados (no se filtra por "active"). Los productos con
-- stock = 0 no reciben movimiento: la suma vacía es 0 y la variación no puede ser 0.
INSERT INTO "stock_movements" ("id", "productId", "variation", "reason", "note")
SELECT
    gen_random_uuid()::text,
    "id",
    "stock",
    'stock_inicial'::"StockMovementReason",
    'Saldo inicial de la migración'
FROM "products"
WHERE "stock" > 0;
