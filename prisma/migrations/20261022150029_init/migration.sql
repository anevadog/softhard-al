-- CreateEnum
CREATE TYPE "Role" AS ENUM ('cliente', 'trabajador', 'encargado', 'admin');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('pendiente', 'diagnosticada', 'aceptada', 'rechazada', 'expirada', 'en_reparacion', 'lista', 'entregada');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('ordenador', 'portatil', 'impresora', 'otro');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('domicilio', 'taller');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('manana', 'tarde', 'indiferente');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('pendiente', 'aceptado', 'rechazado', 'expirado');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'cliente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "equipmentType" "EquipmentType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "modality" "Modality" NOT NULL,
    "preferredDate" TIMESTAMP(3),
    "timeSlot" "TimeSlot" NOT NULL DEFAULT 'indiferente',
    "status" "ServiceStatus" NOT NULL DEFAULT 'pendiente',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "budgetAmount" DECIMAL(10,2) NOT NULL,
    "diagnosticFee" DECIMAL(10,2) NOT NULL,
    "finalAmount" DECIMAL(10,2),
    "status" "QuoteStatus" NOT NULL DEFAULT 'pendiente',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "diagnosticFee" DECIMAL(10,2) NOT NULL DEFAULT 30,
    "expirationDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "service_requests_clientId_createdAt_idx" ON "service_requests"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_requests_assigneeId_idx" ON "service_requests"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_requestId_key" ON "quotes"("requestId");

-- CreateIndex
CREATE INDEX "quotes_status_expiresAt_idx" ON "quotes"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
