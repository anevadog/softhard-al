-- CreateEnum
CREATE TYPE "PaymentSessionStatus" AS ENUM ('pendiente', 'completada', 'fallida', 'abandonada', 'reembolsada');

-- AlterTable
ALTER TABLE "config" ADD COLUMN     "requireDiagnosticPaymentUpfront" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "payment_sessions" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "orderId" TEXT,
    "requestId" TEXT,
    "customerId" TEXT NOT NULL,
    "amountCentimos" INTEGER NOT NULL,
    "status" "PaymentSessionStatus" NOT NULL DEFAULT 'pendiente',
    "returnPath" TEXT NOT NULL,
    "refundReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_sessions_providerRef_key" ON "payment_sessions"("providerRef");

-- CreateIndex
CREATE INDEX "payment_sessions_orderId_status_idx" ON "payment_sessions"("orderId", "status");

-- CreateIndex
CREATE INDEX "payment_sessions_requestId_status_idx" ON "payment_sessions"("requestId", "status");

-- CreateIndex
CREATE INDEX "payment_sessions_customerId_createdAt_idx" ON "payment_sessions"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SQL manual: reglas de la sesión de pago que Prisma no expresa.
-- ---------------------------------------------------------------------------

-- Una sesión cobra un pedido o una solicitud, nunca ambos ni ninguno.
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_target_xor"
  CHECK (("orderId" IS NULL) <> ("requestId" IS NULL));

-- Un pago de 0 € no existe.
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_amount_positive"
  CHECK ("amountCentimos" > 0);

-- Proveedores conocidos.
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_provider_valid"
  CHECK ("provider" IN ('mock', 'stripe'));

-- `completedAt` solo en las completadas (y en las reembolsadas que llegaron a
-- completarse); `refundedAt` y el motivo, siempre y solo en las reembolsadas.
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_completed_at_estado"
  CHECK ("completedAt" IS NULL OR "status" IN ('completada', 'reembolsada'));

ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_completada_fecha"
  CHECK ("status" <> 'completada' OR "completedAt" IS NOT NULL);

ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_reembolso_campos"
  CHECK (("status" = 'reembolsada') = ("refundedAt" IS NOT NULL AND "refundReason" IS NOT NULL));
