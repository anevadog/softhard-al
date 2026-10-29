-- CreateEnum
CREATE TYPE "InvoiceSeries" AS ENUM ('FAC', 'RECT', 'MIG');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('ordinaria', 'rectificativa');

-- CreateEnum
CREATE TYPE "InvoiceConcept" AS ENUM ('venta', 'reparacion', 'diagnostico');

-- CreateEnum
CREATE TYPE "InvoiceMode" AS ENUM ('simplificada', 'completa');

-- AlterTable
ALTER TABLE "config" ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 21;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nif" TEXT;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "series" "InvoiceSeries" NOT NULL,
    "year" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "concept" "InvoiceConcept" NOT NULL,
    "mode" "InvoiceMode" NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBackfill" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "requestId" TEXT,
    "rectifiesInvoiceId" TEXT,
    "reason" TEXT,
    "replacesInvoiceId" TEXT,
    "reissueReason" TEXT,
    "issuedById" TEXT,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerTaxId" TEXT,
    "customerAddress" TEXT,
    "issuerName" TEXT NOT NULL,
    "issuerTaxId" TEXT NOT NULL,
    "issuerAddress" TEXT NOT NULL,
    "issuerEmail" TEXT NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "baseTotal" DECIMAL(10,2) NOT NULL,
    "vatTotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "lineBase" DECIMAL(10,2) NOT NULL,
    "lineVat" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "series" "InvoiceSeries" NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("series","year")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_code_key" ON "invoices"("code");

-- CreateIndex
CREATE INDEX "invoices_issuedAt_idx" ON "invoices"("issuedAt");

-- CreateIndex
CREATE INDEX "invoices_concept_issuedAt_idx" ON "invoices"("concept", "issuedAt");

-- CreateIndex
CREATE INDEX "invoices_orderId_idx" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "invoices_requestId_idx" ON "invoices"("requestId");

-- CreateIndex
CREATE INDEX "invoices_customerId_issuedAt_idx" ON "invoices"("customerId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_series_year_number_key" ON "invoices"("series", "year", "number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_lines_invoiceId_position_key" ON "invoice_lines"("invoiceId", "position");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rectifiesInvoiceId_fkey" FOREIGN KEY ("rectifiesInvoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_replacesInvoiceId_fkey" FOREIGN KEY ("replacesInvoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SQL manual: reglas de la facturación que Prisma no expresa.
-- ---------------------------------------------------------------------------

-- Una factura es de un pedido o de una solicitud, nunca de ambos ni de ninguno.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_target_xor"
  CHECK (("orderId" IS NULL) <> ("requestId" IS NULL));

-- La serie RECT es exactamente la de las rectificativas.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_series_kind"
  CHECK (("series" = 'RECT') = ("kind" = 'rectificativa'));

-- Rectificativa: apunta a la factura que anula, lleva motivo, total <= 0 y no
-- es una re-emisión. Ordinaria: no apunta a ninguna rectificada y total >= 0.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rectificativa_campos"
  CHECK (
    ("kind" = 'rectificativa'
      AND "rectifiesInvoiceId" IS NOT NULL
      AND "reason" IS NOT NULL
      AND "total" <= 0
      AND "replacesInvoiceId" IS NULL)
    OR ("kind" = 'ordinaria'
      AND "rectifiesInvoiceId" IS NULL
      AND "reason" IS NULL
      AND "total" >= 0)
  );

-- Re-emisión: replacesInvoiceId y reissueReason van juntos, solo en la serie
-- FAC, y el motivo tiene entre 10 y 200 caracteres.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reemision_campos"
  CHECK (
    ("replacesInvoiceId" IS NULL AND "reissueReason" IS NULL)
    OR ("replacesInvoiceId" IS NOT NULL
      AND "series" = 'FAC'
      AND char_length("reissueReason") BETWEEN 10 AND 200)
  );

-- Retroactiva si y solo si es de la serie MIG.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_backfill_serie"
  CHECK ("isBackfill" = ("series" = 'MIG'));

-- El desglose cuadra: base + IVA = total, en la factura y en cada línea.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_totales_cuadran"
  CHECK ("baseTotal" + "vatTotal" = "total");

ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_totales_cuadran"
  CHECK ("lineBase" + "lineVat" = "lineTotal");

-- Una sola rectificativa por factura y una sola re-emisión por rectificada
-- (índices parciales: en Prisma son relaciones 1:N).
CREATE UNIQUE INDEX "invoices_rectifies_unique"
  ON "invoices" ("rectifiesInvoiceId") WHERE "rectifiesInvoiceId" IS NOT NULL;

CREATE UNIQUE INDEX "invoices_replaces_unique"
  ON "invoices" ("replacesInvoiceId") WHERE "replacesInvoiceId" IS NOT NULL;

-- Inmutabilidad: ni UPDATE ni DELETE en facturas ni en sus líneas. Única
-- excepción, el DELETE de una transacción que haya hecho antes
-- SET LOCAL softhard.permitir_borrado_facturas = 'on'; solo lo usa la limpieza
-- de los tests de integración sin rollback. La aplicación nunca lo activa.
CREATE FUNCTION "facturas_inmutables"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('softhard.permitir_borrado_facturas', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Las facturas son inmutables: % no permitido en %', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "invoices_inmutables"
  BEFORE UPDATE OR DELETE ON "invoices"
  FOR EACH ROW EXECUTE FUNCTION "facturas_inmutables"();

CREATE TRIGGER "invoice_lines_inmutables"
  BEFORE UPDATE OR DELETE ON "invoice_lines"
  FOR EACH ROW EXECUTE FUNCTION "facturas_inmutables"();
