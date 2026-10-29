-- Facturas retroactivas (serie MIG, 4.3b). Todo cobro registrado sin factura
-- (los del backfill de 4.0 y los anteriores a 4.3a) recibe la suya, para que
-- el invariante "todo paidAt no nulo tiene factura" se cumpla y el dashboard
-- tenga histórico.
--
-- Reglas, iguales que en la app (`lib/invoices.ts`, `lib/vat.ts` y
-- `contenidoFacturaEnTx`):
-- - issuedAt = paidAt, total = paidAmount, isBackfill = true, sin autor.
-- - Concepto: pedido → venta; solicitud con presupuesto aceptado → reparacion;
--   cualquier otro presupuesto → diagnostico.
-- - Líneas: una por línea de pedido (en orden de id); "Reparación de <equipo>
--   <marca> <modelo>" + "Descuento diagnóstico"; o "Diagnóstico". Si lo
--   cobrado difiere de la suma, "Ajuste de importe" por la diferencia.
-- - Desglose en céntimos línea a línea: base = ROUND(total / (1 + tipo)),
--   IVA = total − base; tipo = config.vatRate (21 si no hay fila).
-- - Numeración correlativa por año natural en Europe/Madrid, en orden de
--   paidAt, a continuación del contador MIG de ese año.
-- - Cliente con los datos actuales: con NIF, factura completa (NIF y dirección
--   de la solicitud si existe); sin NIF, simplificada.
-- - IDs deterministas: 'mig-<id de la entidad>' y 'mig-<id>-<posición>'.
--
-- Va en una función para poder probarla en los tests de integración (la base
-- de test se migra vacía). Solo factura entidades sin ninguna factura, así que
-- una segunda llamada no hace nada. Al terminar comprueba el invariante y, si
-- falla, aborta: la llamada es una sola sentencia y se revierte entera.
CREATE FUNCTION "emitir_facturas_retroactivas"() RETURNS integer AS $$
DECLARE
  tipo numeric(5, 2);
  puntos numeric;
  creadas integer;
BEGIN
  tipo := COALESCE((SELECT "vatRate" FROM "config" WHERE "id" = 1), 21);
  puntos := ROUND(tipo * 100);

  DROP TABLE IF EXISTS "_mig_cobros", "_mig_lineas", "_mig_facturas";

  -- Cobros sin factura.
  CREATE TEMP TABLE "_mig_cobros" ON COMMIT DROP AS
  SELECT
    o."id" AS entidad_id,
    true AS es_pedido,
    o."userId" AS customer_id,
    o."paidAt" AS paid_at,
    ROUND(o."paidAmount" * 100)::bigint AS cobrado,
    o."paymentMethod" AS payment_method,
    NULL::text AS address,
    'venta'::"InvoiceConcept" AS concept
  FROM "orders" o
  WHERE o."paidAt" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."orderId" = o."id")
  UNION ALL
  SELECT
    sr."id",
    false,
    sr."clientId",
    sr."paidAt",
    ROUND(sr."paidAmount" * 100)::bigint,
    sr."paymentMethod",
    sr."address",
    (CASE WHEN q."status" = 'aceptado' THEN 'reparacion' ELSE 'diagnostico' END)::"InvoiceConcept"
  FROM "service_requests" sr
  JOIN "quotes" q ON q."requestId" = sr."id"
  WHERE sr."paidAt" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."requestId" = sr."id");

  -- Líneas antes del desglose (PVP unitario en céntimos).
  CREATE TEMP TABLE "_mig_lineas" ON COMMIT DROP AS
  SELECT
    c.entidad_id,
    ROW_NUMBER() OVER (PARTITION BY oi."orderId" ORDER BY oi."id")::integer AS posicion,
    p."name" AS descripcion,
    oi."quantity" AS cantidad,
    ROUND(oi."price" * 100)::bigint AS unitario
  FROM "_mig_cobros" c
  JOIN "order_items" oi ON oi."orderId" = c.entidad_id
  JOIN "products" p ON p."id" = oi."productId"
  WHERE c.es_pedido
  UNION ALL
  SELECT
    c.entidad_id,
    1,
    btrim(
      'Reparación de '
      || CASE sr."equipmentType"
           WHEN 'ordenador' THEN 'ordenador'
           WHEN 'portatil' THEN 'portátil'
           WHEN 'impresora' THEN 'impresora'
           ELSE 'otro'
         END
      || ' ' || sr."brand" || ' ' || sr."model"
    ),
    1,
    ROUND(q."budgetAmount" * 100)::bigint
  FROM "_mig_cobros" c
  JOIN "service_requests" sr ON sr."id" = c.entidad_id
  JOIN "quotes" q ON q."requestId" = sr."id"
  WHERE c.concept = 'reparacion'
  UNION ALL
  SELECT c.entidad_id, 2, 'Descuento diagnóstico', 1, -ROUND(q."diagnosticFee" * 100)::bigint
  FROM "_mig_cobros" c
  JOIN "quotes" q ON q."requestId" = c.entidad_id
  WHERE c.concept = 'reparacion'
  UNION ALL
  SELECT c.entidad_id, 1, 'Diagnóstico', 1, ROUND(q."diagnosticFee" * 100)::bigint
  FROM "_mig_cobros" c
  JOIN "quotes" q ON q."requestId" = c.entidad_id
  WHERE c.concept = 'diagnostico';

  -- Ajuste de importe: lo cobrado menos la suma de las líneas, si no es 0.
  INSERT INTO "_mig_lineas" (entidad_id, posicion, descripcion, cantidad, unitario)
  SELECT
    c.entidad_id,
    COALESCE(MAX(l.posicion), 0) + 1,
    'Ajuste de importe',
    1,
    c.cobrado - COALESCE(SUM(l.unitario * l.cantidad), 0)
  FROM "_mig_cobros" c
  LEFT JOIN "_mig_lineas" l ON l.entidad_id = c.entidad_id
  GROUP BY c.entidad_id, c.cobrado
  HAVING c.cobrado <> COALESCE(SUM(l.unitario * l.cantidad), 0);

  -- Número por año (Europe/Madrid) en orden de paidAt, tras el contador actual.
  CREATE TEMP TABLE "_mig_facturas" ON COMMIT DROP AS
  SELECT
    c.*,
    n.anio,
    COALESCE(k."lastNumber", 0)
      + ROW_NUMBER() OVER (PARTITION BY n.anio ORDER BY c.paid_at, c.entidad_id)::integer AS numero
  FROM "_mig_cobros" c
  CROSS JOIN LATERAL (
    SELECT EXTRACT(YEAR FROM (c.paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid')::integer AS anio
  ) n
  LEFT JOIN "invoice_counters" k ON k."series" = 'MIG' AND k."year" = n.anio;

  INSERT INTO "invoices" (
    "id", "series", "year", "number", "code", "kind", "concept", "mode",
    "issuedAt", "isBackfill", "orderId", "requestId",
    "customerId", "customerName", "customerEmail", "customerTaxId", "customerAddress",
    "issuerName", "issuerTaxId", "issuerAddress", "issuerEmail",
    "vatRate", "baseTotal", "vatTotal", "total", "paymentMethod"
  )
  SELECT
    'mig-' || f.entidad_id,
    'MIG'::"InvoiceSeries",
    f.anio,
    f.numero,
    'MIG-' || f.anio || '-' || lpad(f.numero::text, GREATEST(4, length(f.numero::text)), '0'),
    'ordinaria'::"InvoiceKind",
    f.concept,
    m.mode,
    f.paid_at,
    true,
    CASE WHEN f.es_pedido THEN f.entidad_id END,
    CASE WHEN NOT f.es_pedido THEN f.entidad_id END,
    u."id",
    u."name",
    u."email",
    CASE WHEN m.mode = 'completa' THEN u."nif" END,
    CASE WHEN m.mode = 'completa' THEN f.address END,
    -- Emisor: copia de EMISOR en `lib/invoices.ts`.
    'SoftHard A&L, S.L. (demo)',
    'B00000000',
    'Calle de Ejemplo 12, 28001 Madrid',
    'hola@softhard-al.demo',
    tipo,
    t.base / 100.0,
    (t.total - t.base) / 100.0,
    t.total / 100.0,
    f.payment_method
  FROM "_mig_facturas" f
  JOIN "users" u ON u."id" = f.customer_id
  CROSS JOIN LATERAL (
    SELECT (CASE WHEN COALESCE(u."nif", '') <> '' THEN 'completa' ELSE 'simplificada' END)::"InvoiceMode" AS mode
  ) m
  JOIN (
    SELECT
      l.entidad_id,
      SUM(l.unitario * l.cantidad) AS total,
      SUM(ROUND(l.unitario * l.cantidad * 10000::numeric / (10000 + puntos))) AS base
    FROM "_mig_lineas" l
    GROUP BY l.entidad_id
  ) t ON t.entidad_id = f.entidad_id;

  GET DIAGNOSTICS creadas = ROW_COUNT;

  INSERT INTO "invoice_lines" (
    "id", "invoiceId", "position", "description", "quantity",
    "unitPrice", "lineTotal", "lineBase", "lineVat"
  )
  SELECT
    'mig-' || l.entidad_id || '-' || l.posicion,
    'mig-' || l.entidad_id,
    l.posicion,
    l.descripcion,
    l.cantidad,
    l.unitario / 100.0,
    d.total / 100.0,
    d.base / 100.0,
    (d.total - d.base) / 100.0
  FROM "_mig_lineas" l
  CROSS JOIN LATERAL (
    SELECT
      l.unitario * l.cantidad AS total,
      ROUND(l.unitario * l.cantidad * 10000::numeric / (10000 + puntos)) AS base
  ) d;

  INSERT INTO "invoice_counters" ("series", "year", "lastNumber")
  SELECT 'MIG'::"InvoiceSeries", f.anio, MAX(f.numero)
  FROM "_mig_facturas" f
  GROUP BY f.anio
  ON CONFLICT ("series", "year") DO UPDATE SET "lastNumber" = EXCLUDED."lastNumber";

  DROP TABLE "_mig_cobros", "_mig_lineas", "_mig_facturas";

  -- Invariante de cobertura: todo cobro tiene factura.
  IF EXISTS (
       SELECT 1 FROM "orders" o
       WHERE o."paidAt" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."orderId" = o."id"))
     OR EXISTS (
       SELECT 1 FROM "service_requests" sr
       WHERE sr."paidAt" IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM "invoices" i WHERE i."requestId" = sr."id")) THEN
    RAISE EXCEPTION 'Quedan cobros sin factura tras emitir las retroactivas';
  END IF;

  RETURN creadas;
END;
$$ LANGUAGE plpgsql;

SELECT "emitir_facturas_retroactivas"();
