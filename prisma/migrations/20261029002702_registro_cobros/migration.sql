-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paidAmount" DECIMAL(10,2),
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentNote" TEXT;

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "paidAmount" DECIMAL(10,2),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentNote" TEXT;

-- CreateIndex
CREATE INDEX "service_requests_paidAt_idx" ON "service_requests"("paidAt");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill (manual): los pedidos ya cobrados (paidAt de la migración de
-- caducidad) reciben como importe cobrado su total.
UPDATE "orders"
SET "paidAmount" = "total"
WHERE "paidAt" IS NOT NULL;

-- Backfill (manual): las reparaciones ya entregadas con importe final > 0 se
-- dan por cobradas en la fecha de su último paso a entregada (o updatedAt si
-- no hay historial). Método y autor quedan nulos: no se conocen.
UPDATE "service_requests" AS sr
SET "paidAt" = COALESCE(
      (SELECT MAX(h."createdAt")
       FROM "service_status_history" h
       WHERE h."requestId" = sr."id" AND h."toStatus" = 'entregada'),
      sr."updatedAt"),
    "paidAmount" = q."finalAmount",
    "paymentNote" = 'Cobro anterior al registro de pagos'
FROM "quotes" q
WHERE q."requestId" = sr."id"
  AND sr."status" = 'entregada'
  AND q."status" = 'aceptado'
  AND q."finalAmount" > 0;

-- Checks (manuales), iguales en las dos tablas, después del backfill:
-- paidAt y paidAmount van juntos; un cobro de 0 € no existe; el método es de
-- una lista cerrada; sin cobro, el resto de campos del cobro es nulo.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_paid_fields_together" CHECK (("paidAt" IS NULL) = ("paidAmount" IS NULL)),
  ADD CONSTRAINT "orders_paid_amount_positive" CHECK ("paidAmount" IS NULL OR "paidAmount" > 0),
  ADD CONSTRAINT "orders_payment_method_valid" CHECK ("paymentMethod" IS NULL OR "paymentMethod" IN ('efectivo', 'bizum', 'transferencia', 'tarjeta_online')),
  ADD CONSTRAINT "orders_payment_only_if_paid" CHECK ("paidAt" IS NOT NULL OR ("paymentMethod" IS NULL AND "paidById" IS NULL AND "paymentNote" IS NULL));

ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_paid_fields_together" CHECK (("paidAt" IS NULL) = ("paidAmount" IS NULL)),
  ADD CONSTRAINT "service_requests_paid_amount_positive" CHECK ("paidAmount" IS NULL OR "paidAmount" > 0),
  ADD CONSTRAINT "service_requests_payment_method_valid" CHECK ("paymentMethod" IS NULL OR "paymentMethod" IN ('efectivo', 'bizum', 'transferencia', 'tarjeta_online')),
  ADD CONSTRAINT "service_requests_payment_only_if_paid" CHECK ("paidAt" IS NOT NULL OR ("paymentMethod" IS NULL AND "paidById" IS NULL AND "paymentNote" IS NULL));
