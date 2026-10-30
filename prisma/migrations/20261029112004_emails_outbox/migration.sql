-- CreateEnum
CREATE TYPE "EmailEvent" AS ENUM ('pedido_confirmado', 'presupuesto_listo', 'reparacion_lista');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('pendiente', 'enviando', 'enviado', 'fallido');

-- CreateTable
CREATE TABLE "pending_emails" (
    "id" TEXT NOT NULL,
    "event" "EmailEvent" NOT NULL,
    "entityId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'pendiente',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_emails_status_createdAt_idx" ON "pending_emails"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_emails_event_entityId_key" ON "pending_emails"("event", "entityId");

-- ---------------------------------------------------------------------------
-- SQL manual: coherencia de estados que Prisma no expresa.
-- ---------------------------------------------------------------------------

-- Intentos entre 0 y 5: a los 5 el email queda `fallido`.
ALTER TABLE "pending_emails" ADD CONSTRAINT "pending_emails_attempts_rango"
  CHECK ("attempts" BETWEEN 0 AND 5);

-- `sentAt` solo y siempre en los enviados; `lockedAt` siempre mientras se envía.
ALTER TABLE "pending_emails" ADD CONSTRAINT "pending_emails_sent_at_estado"
  CHECK (("sentAt" IS NOT NULL) = ("status" = 'enviado'));

ALTER TABLE "pending_emails" ADD CONSTRAINT "pending_emails_locked_at_enviando"
  CHECK ("status" <> 'enviando' OR "lockedAt" IS NOT NULL);
