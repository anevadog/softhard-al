-- CreateEnum
CREATE TYPE "RequestNoteType" AS ENUM ('normal', 'falta_repuesto');

-- AlterEnum
ALTER TYPE "ServiceStatus" ADD VALUE 'esperando_repuesto';

-- AlterTable
ALTER TABLE "config" ADD COLUMN     "inactiveRequestHours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "openWorkLogHours" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "service_status_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "ServiceStatus" NOT NULL,
    "toStatus" "ServiceStatus" NOT NULL,
    "changedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_assignment_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromAssigneeId" TEXT,
    "toAssigneeId" TEXT,
    "changedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_notes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" "RequestNoteType" NOT NULL DEFAULT 'normal',
    "body" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_status_history_requestId_createdAt_idx" ON "service_status_history"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "service_status_history_toStatus_idx" ON "service_status_history"("toStatus");

-- CreateIndex
CREATE INDEX "service_assignment_history_requestId_createdAt_idx" ON "service_assignment_history"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "service_assignment_history_toAssigneeId_createdAt_idx" ON "service_assignment_history"("toAssigneeId", "createdAt");

-- CreateIndex
CREATE INDEX "work_logs_userId_startedAt_idx" ON "work_logs"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "work_logs_requestId_startedAt_idx" ON "work_logs"("requestId", "startedAt");

-- CreateIndex
CREATE INDEX "request_notes_requestId_createdAt_idx" ON "request_notes"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "request_notes_type_resolvedAt_idx" ON "request_notes"("type", "resolvedAt");

-- CreateIndex
CREATE INDEX "service_requests_lastActivityAt_idx" ON "service_requests"("lastActivityAt");

-- AddForeignKey
ALTER TABLE "service_status_history" ADD CONSTRAINT "service_status_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_status_history" ADD CONSTRAINT "service_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignment_history" ADD CONSTRAINT "service_assignment_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignment_history" ADD CONSTRAINT "service_assignment_history_fromAssigneeId_fkey" FOREIGN KEY ("fromAssigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignment_history" ADD CONSTRAINT "service_assignment_history_toAssigneeId_fkey" FOREIGN KEY ("toAssigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignment_history" ADD CONSTRAINT "service_assignment_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SQL manual: un trabajador no puede tener dos fichajes abiertos a la vez.
-- Índice único parcial no representable en el schema de Prisma.
CREATE UNIQUE INDEX "work_logs_open_user_unique"
ON "work_logs"("userId")
WHERE "endedAt" IS NULL;

-- SQL manual: la salida nunca puede ser anterior a la entrada.
ALTER TABLE "work_logs"
ADD CONSTRAINT "work_logs_end_after_start"
CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");

-- SQL manual: las filas existentes heredan su última actualización como
-- última actividad; el DEFAULT CURRENT_TIMESTAMP se mantiene para las nuevas.
UPDATE "service_requests"
SET "lastActivityAt" = "updatedAt";
