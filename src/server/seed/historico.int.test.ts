import { describe, expect, it } from "vitest";

import { mesHistorico } from "@/lib/seed-dates";
import { planHistorico } from "@/server/seed/historico-datos";
import { enTransaccion, libroStock, type Tx } from "@/test/integration/db";

// 29/10/2026 12:00 en Madrid.
const AHORA = new Date("2026-10-29T10:00:00Z");

async function sembrarTodo(tx: Tx, ahora: Date) {
  const demo = await import("@/server/seed/demo");
  const { sembrarHistorico } = await import("@/server/seed/historico");

  await demo.sembrarConfig(tx);
  await demo.sembrarUsuarios(tx, "sin-login");
  await demo.sembrarProductos(tx);

  return sembrarHistorico(tx, ahora);
}

async function idsHistorico() {
  const { idPedido, idReparacion } = await import("@/server/seed/historico");
  const plan = planHistorico();
  const reparacion = (f: (r: (typeof plan.reparaciones)[number]) => boolean) =>
    idReparacion((plan.reparaciones.find(f) as { n: number }).n);
  const pedido = (f: (p: (typeof plan.pedidos)[number]) => boolean) =>
    idPedido((plan.pedidos.find(f) as { n: number }).n);

  return {
    reemitida: reparacion((r) => Boolean(r.rectificacion?.reemision)),
    diagnosticoMes3: reparacion(
      (r) => "mes" in r.fecha && r.fecha.mes === 3 && r.estado === "rechazada",
    ),
    rectificadoMes6: pedido((p) => Boolean(p.rectificacion)),
    ajusteMes7: pedido((p) => Boolean(p.cobro?.ajuste)),
    caducadoMes11: pedido((p) => p.estado === "caducado"),
  };
}

async function cobrosSinFactura(tx: Tx): Promise<number> {
  const [fila] = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM "orders" o WHERE o."paidAt" IS NOT NULL
         AND o."id" NOT IN (SELECT "orderId" FROM "invoices" WHERE "orderId" IS NOT NULL))
      + (SELECT COUNT(*) FROM "service_requests" sr WHERE sr."paidAt" IS NOT NULL
         AND sr."id" NOT IN (SELECT "requestId" FROM "invoices" WHERE "requestId" IS NOT NULL)) AS "n"`;

  return Number(fila.n);
}

async function netoEntre(tx: Tx, inicio: Date, fin: Date, where: object = {}): Promise<number> {
  const suma = await tx.invoice.aggregate({
    where: { id: { startsWith: "seed-inv-" }, issuedAt: { gte: inicio, lt: fin }, ...where },
    _sum: { total: true },
  });

  return Number(suma._sum.total ?? 0);
}

async function recuentos(tx: Tx) {
  const seed = { id: { startsWith: "seed-" } };
  const [reparaciones, pedidos, facturas, lineas, movimientos, historial, contadores] =
    await Promise.all([
      tx.serviceRequest.count({ where: seed }),
      tx.order.count({ where: seed }),
      tx.invoice.count({ where: seed }),
      tx.invoiceLine.count({ where: { invoiceId: { startsWith: "seed-" } } }),
      tx.stockMovement.count(),
      tx.serviceStatusHistory.count({ where: { requestId: { startsWith: "seed-" } } }),
      tx.invoiceCounter.findMany({ orderBy: [{ series: "asc" }, { year: "asc" }] }),
    ]);

  return { reparaciones, pedidos, facturas, lineas, movimientos, historial, contadores };
}

describe("seed histórico", () => {
  it("todo cobro tiene factura y hay ingresos en al menos 10 de los 12 meses", () =>
    enTransaccion(async (tx) => {
      const resumen = await sembrarTodo(tx, AHORA);
      expect(resumen.reparaciones).toBeGreaterThan(40);
      expect(resumen.pedidos).toBeGreaterThan(15);

      expect(await cobrosSinFactura(tx)).toBe(0);

      const netos: number[] = [];
      for (let k = 1; k <= 12; k++) {
        const mes = mesHistorico(k, AHORA);
        netos.push(await netoEntre(tx, mes.inicio, mes.fin));
      }
      expect(netos.filter((neto) => neto > 0).length).toBeGreaterThanOrEqual(10);

      // Reparto por concepto (ordinarias): 60 % / 30 % / 10 % aproximado.
      const porConcepto = await tx.invoice.groupBy({
        by: ["concept"],
        where: { id: { startsWith: "seed-inv-" }, series: "MIG" },
        _count: true,
      });
      const cuenta = Object.fromEntries(porConcepto.map((g) => [g.concept, g._count]));
      expect(cuenta.reparacion).toBeGreaterThan(cuenta.venta);
      expect(cuenta.venta).toBeGreaterThan(cuenta.diagnostico);
    }));

  it("las MIG del seed tienen issuedAt = paidAt y total = paidAmount; nada en el futuro", () =>
    enTransaccion(async (tx) => {
      await sembrarTodo(tx, AHORA);

      const migs = await tx.invoice.findMany({
        where: { id: { startsWith: "seed-inv-" }, series: "MIG" },
        include: { order: true, request: true },
      });
      expect(migs.length).toBeGreaterThan(40);
      for (const factura of migs) {
        const entidad = factura.order ?? factura.request;
        expect(factura.isBackfill).toBe(true);
        expect(factura.issuedAt).toEqual(entidad?.paidAt);
        expect(factura.total.toString()).toBe(entidad?.paidAmount?.toString());
      }

      const otrasRetroactivas = await tx.invoice.count({
        where: { isBackfill: true, series: { not: "MIG" } },
      });
      expect(otrasRetroactivas).toBe(0);

      const futuro = { gt: AHORA };
      const [enFuturo] = await Promise.all([
        Promise.all([
          tx.serviceRequest.count({ where: { id: { startsWith: "seed-" }, OR: [{ createdAt: futuro }, { paidAt: futuro }, { lastActivityAt: futuro }] } }),
          tx.order.count({ where: { id: { startsWith: "seed-" }, OR: [{ createdAt: futuro }, { paidAt: futuro }, { updatedAt: futuro }] } }),
          tx.invoice.count({ where: { id: { startsWith: "seed-" }, issuedAt: futuro } }),
          tx.serviceStatusHistory.count({ where: { requestId: { startsWith: "seed-" }, createdAt: futuro } }),
        ]),
      ]);
      expect(enFuturo).toEqual([0, 0, 0, 0]);
    }));

  it("casos especiales de los meses 3, 6, 7, 9 y 11", () =>
    enTransaccion(async (tx) => {
      await sembrarTodo(tx, AHORA);
      const ids = await idsHistorico();
      const config = await tx.config.findUniqueOrThrow({ where: { id: 1 } });

      // Mes 3: rechazada con cobro del diagnóstico y su MIG de diagnóstico.
      const diagnostico = await tx.serviceRequest.findUniqueOrThrow({
        where: { id: ids.diagnosticoMes3 },
        include: { quote: true, invoices: true },
      });
      expect(diagnostico.status).toBe("rechazada");
      expect(diagnostico.quote?.finalAmount?.toString()).toBe(config.diagnosticFee.toString());
      expect(diagnostico.paidAt).not.toBeNull();
      expect(diagnostico.invoices.map((f) => [f.series, f.concept])).toEqual([["MIG", "diagnostico"]]);

      // Mes 6: pedido rectificado por cambio de NIF, sin re-emisión: neto 0.
      const rectificadas = await tx.invoice.findMany({
        where: { orderId: ids.rectificadoMes6 },
        orderBy: { issuedAt: "asc" },
      });
      expect(rectificadas.map((f) => f.series)).toEqual(["MIG", "RECT"]);
      expect(rectificadas[1]).toMatchObject({ reason: "Cambio de NIF", rectifiesInvoiceId: rectificadas[0].id });
      expect(rectificadas.reduce((suma, f) => suma + Number(f.total), 0)).toBe(0);
      const mes6 = mesHistorico(6, AHORA);
      for (const factura of rectificadas) {
        expect(factura.issuedAt >= mes6.inicio && factura.issuedAt < mes6.fin).toBe(true);
      }

      // Mes 7: cobro distinto del total, por el admin, con ajuste en la factura.
      const ajustado = await tx.order.findUniqueOrThrow({
        where: { id: ids.ajusteMes7 },
        include: { paidBy: true, invoices: { include: { lines: { orderBy: { position: "asc" } } } } },
      });
      expect(ajustado.paidAmount?.toString()).not.toBe(ajustado.total.toString());
      expect(ajustado.paidBy?.email).toBe("admin@demo.local");
      expect(ajustado.paymentNote).toBeTruthy();
      const [facturaAjuste] = ajustado.invoices;
      expect(facturaAjuste.total.toString()).toBe(ajustado.paidAmount?.toString());
      expect(facturaAjuste.lines.at(-1)?.description).toBe("Ajuste de importe");

      // Mes 9: MIG, RECT y re-emisión FAC dentro del mes; neto = lo cobrado.
      const reemitida = await tx.serviceRequest.findUniqueOrThrow({
        where: { id: ids.reemitida },
        include: { invoices: { orderBy: { issuedAt: "asc" } } },
      });
      const [mig, rect, fac] = reemitida.invoices;
      expect(reemitida.invoices.map((f) => f.series)).toEqual(["MIG", "RECT", "FAC"]);
      expect(rect.rectifiesInvoiceId).toBe(mig.id);
      expect(fac.replacesInvoiceId).toBe(mig.id);
      expect(fac.reissueReason).toBeTruthy();
      expect(fac.isBackfill).toBe(false);
      const mes9 = mesHistorico(9, AHORA);
      expect(await netoEntre(tx, mes9.inicio, mes9.fin, { requestId: ids.reemitida })).toBe(
        Number(reemitida.paidAmount),
      );

      // Mes 11: pedido caducado, sin cobro ni factura, con su reposición.
      const caducado = await tx.order.findUniqueOrThrow({
        where: { id: ids.caducadoMes11 },
        include: { invoices: true, stockMovements: true },
      });
      expect(caducado).toMatchObject({ status: "caducado", paidAt: null });
      expect(caducado.invoices).toHaveLength(0);
      expect(caducado.stockMovements.map((m) => m.reason).sort()).toEqual(["caducidad_pedido", "venta"]);
      expect(caducado.stockMovements.find((m) => m.reason === "caducidad_pedido")?.userId).toBeNull();
    }));

  it("el libro de stock cuadra y el stock final es el mismo que antes del histórico", () =>
    enTransaccion(async (tx) => {
      const demo = await import("@/server/seed/demo");
      const { sembrarHistorico } = await import("@/server/seed/historico");
      await demo.sembrarConfig(tx);
      await demo.sembrarUsuarios(tx, "sin-login");
      await demo.sembrarProductos(tx);

      const ids = demo.DEMO_PRODUCTS.map((p) => p.id);
      const antes = await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, stock: true } });

      await sembrarHistorico(tx, AHORA);

      for (const { id, stock } of antes) {
        const libro = await libroStock(tx, id);
        expect(libro.suma).toBe(libro.stock);
        expect(libro.stock).toBe(stock);
      }
    }));

  it("ejecutarlo dos veces no duplica nada", () =>
    enTransaccion(async (tx) => {
      await sembrarTodo(tx, AHORA);
      const primera = await recuentos(tx);

      const segunda = await sembrarTodo(tx, new Date(AHORA.getTime() + 3 * 24 * 60 * 60 * 1000));
      expect(segunda).toEqual({ reparaciones: 0, pedidos: 0, facturas: 0 });
      expect(await recuentos(tx)).toEqual(primera);
    }));

  it("el día 1 de madrugada tampoco crea nada en el futuro", () =>
    enTransaccion(async (tx) => {
      // 01/11/2026 00:30 en Madrid.
      const madrugada = new Date("2026-10-31T23:30:00Z");
      await sembrarTodo(tx, madrugada);

      expect(await cobrosSinFactura(tx)).toBe(0);
      expect(
        await tx.invoice.count({ where: { id: { startsWith: "seed-" }, issuedAt: { gt: madrugada } } }),
      ).toBe(0);
      expect(
        await tx.serviceStatusHistory.count({
          where: { requestId: { startsWith: "seed-" }, createdAt: { gt: madrugada } },
        }),
      ).toBe(0);
    }));
});
