-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'caducado';

-- AlterEnum
ALTER TYPE "StockMovementReason" ADD VALUE 'caducidad_pedido';

-- AlterTable
ALTER TABLE "config" ADD COLUMN     "pendingOrderHours" INTEGER NOT NULL DEFAULT 48;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_status_expiresAt_idx" ON "orders"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "orders_paidAt_idx" ON "orders"("paidAt");

-- Backfill (manual): los pedidos pendientes existentes caducan 48 h después de
-- crearse (valor por defecto de pendingOrderHours). Si ya han vencido, caducan
-- en la primera lectura posterior a la migración.
UPDATE "orders"
SET "expiresAt" = "createdAt" + INTERVAL '48 hours'
WHERE "status" = 'pendiente';

-- Backfill (manual): los pedidos ya cobrados no tienen fecha de cobro. Se
-- aproxima con updatedAt (la última modificación, normalmente el paso a pagado
-- o a entregado).
UPDATE "orders"
SET "paidAt" = "updatedAt"
WHERE "status" IN ('pagado', 'entregado');
