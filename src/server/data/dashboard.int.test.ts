import { describe, expect, it } from "vitest";

import { ingresosPorMes, periodoDesdeParam, resumirIngresos } from "@/lib/dashboard";
import {
  crearPresupuesto,
  crearProducto,
  crearSolicitud,
  crearUsuario,
  enTransaccion,
  type Tx,
} from "@/test/integration/db";

/**
 * Dashboard de ingresos: suma de `Invoice.total` por `issuedAt`. Las fechas van
 * en 2031 para no mezclarse con otros datos de la base de test.
 */

// 15/03/2031 12:00 en Madrid: "12 meses" va de abril de 2030 a marzo de 2031.
const AHORA = new Date("2031-03-15T11:00:00Z");
const ENERO = new Date("2031-01-15T10:00:00Z");
const FEBRERO = new Date("2031-02-15T10:00:00Z");
const MARZO = new Date("2031-03-05T10:00:00Z");

type Entidad = { tipo: "pedido"; id: string } | { tipo: "solicitud"; id: string };

/** Pedido entregado y cobrado (sin factura todavía). */
async function pedidoCobrado(tx: Tx, precio: string, paidAt: Date) {
  const cliente = await crearUsuario(tx, "cliente");
  const producto = await crearProducto(tx, { stock: 5, price: precio });

  const pedido = await tx.order.create({
    data: {
      userId: cliente.id,
      total: precio,
      status: "entregado",
      paidAt,
      paidAmount: precio,
      paymentMethod: "bizum",
      items: { create: [{ productId: producto.id, quantity: 1, price: precio }] },
    },
  });

  return { tipo: "pedido", id: pedido.id } as const;
}

/** Solicitud cobrada: reparación aceptada (presupuesto 120 − 30) o diagnóstico. */
async function solicitudCobrada(tx: Tx, tipo: "reparacion" | "diagnostico", paidAt: Date) {
  const cliente = await crearUsuario(tx, "cliente");
  const solicitud = await crearSolicitud(tx, {
    clientId: cliente.id,
    status: tipo === "reparacion" ? "entregada" : "rechazada",
  });
  await crearPresupuesto(tx, {
    requestId: solicitud.id,
    status: tipo === "reparacion" ? "aceptado" : "rechazado",
  });
  await tx.serviceRequest.update({
    where: { id: solicitud.id },
    data: { paidAt, paidAmount: tipo === "reparacion" ? "90.00" : "30.00", paymentMethod: "efectivo" },
  });

  return { tipo: "solicitud", id: solicitud.id } as const;
}

async function facturar(tx: Tx, entidad: Entidad, fecha: Date, serie: "FAC" | "MIG" = "FAC") {
  const { emitirFacturaDeCobroEnTx } = await import("@/server/data/invoices");
  const factura = await emitirFacturaDeCobroEnTx(tx, entidad, fecha, { serie });
  if (!factura) throw new Error("no facturable");

  return factura;
}

async function rectificar(tx: Tx, invoiceId: string, fecha: Date) {
  const { emitirRectificativaEnTx } = await import("@/server/data/invoices");
  const staff = await crearUsuario(tx, "encargado");

  return emitirRectificativaEnTx(tx, { invoiceId, motivo: "Error en los datos", staffId: staff.id }, fecha);
}

async function ingresos(clave: string, ahora = AHORA) {
  const { obtenerFilasIngresos } = await import("@/server/data/dashboard");
  const periodo = periodoDesdeParam(clave, ahora);
  const filas = await obtenerFilasIngresos(periodo);

  return {
    resumen: resumirIngresos(filas),
    porMes: Object.fromEntries(
      ingresosPorMes(filas, periodo.meses).map((mes) => [mes.mes.clave, mes.netoCentimos]),
    ),
  };
}

describe("ingresos del dashboard", () => {
  it("cada concepto suma lo esperado, incluidas las retroactivas MIG", () =>
    enTransaccion(async (tx) => {
      await facturar(tx, await pedidoCobrado(tx, "49.90", ENERO), ENERO);
      await facturar(tx, await pedidoCobrado(tx, "10.00", FEBRERO), FEBRERO, "MIG");
      await facturar(tx, await solicitudCobrada(tx, "reparacion", FEBRERO), FEBRERO, "MIG");
      await facturar(tx, await solicitudCobrada(tx, "diagnostico", MARZO), MARZO);

      const { resumen } = await ingresos("12-meses");
      expect(resumen).toMatchObject({
        ventasCentimos: 5_990,
        reparacionesCentimos: 9_000,
        diagnosticosCentimos: 3_000,
        netoCentimos: 17_990,
        rectificadoCentimos: 0,
        facturasPorSerie: { FAC: 2, RECT: 0, MIG: 2 },
      });
    }));

  it("una rectificativa resta en el mes de su emisión, no en el de la original", () =>
    enTransaccion(async (tx) => {
      const entidad = await pedidoCobrado(tx, "80.00", ENERO);
      const original = await facturar(tx, entidad, ENERO);
      await rectificar(tx, original.id, FEBRERO);

      const { porMes, resumen } = await ingresos("12-meses");
      expect(porMes["2031-01"]).toBe(8_000);
      expect(porMes["2031-02"]).toBe(-8_000);
      expect(resumen).toMatchObject({ netoCentimos: 0, rectificadoCentimos: -8_000 });
    }));

  it("original y rectificativa del mismo mes se compensan", () =>
    enTransaccion(async (tx) => {
      const original = await facturar(tx, await pedidoCobrado(tx, "35.00", MARZO), MARZO);
      await rectificar(tx, original.id, new Date(MARZO.getTime() + 60 * 60 * 1000));

      const { porMes } = await ingresos("mes-actual");
      expect(porMes["2031-03"]).toBe(0);
    }));

  it("original, rectificativa y re-emisión dan un neto igual al cobro", () =>
    enTransaccion(async (tx) => {
      const { reemitirFacturaEnTx } = await import("@/server/data/invoices");
      const entidad = await solicitudCobrada(tx, "reparacion", ENERO);
      const original = await facturar(tx, entidad, ENERO, "MIG");
      await rectificar(tx, original.id, FEBRERO);
      const staff = await crearUsuario(tx, "encargado");
      await reemitirFacturaEnTx(
        tx,
        { entidad, motivo: "Corrección del NIF del cliente", staffId: staff.id },
        MARZO,
      );

      const { porMes, resumen } = await ingresos("12-meses");
      expect([porMes["2031-01"], porMes["2031-02"], porMes["2031-03"]]).toEqual([9_000, -9_000, 9_000]);
      expect(resumen.netoCentimos).toBe(9_000);
      expect(resumen.facturasPorSerie).toEqual({ FAC: 1, RECT: 1, MIG: 1 });
    }));

  it("un cobro sin factura no suma", () =>
    enTransaccion(async (tx) => {
      await pedidoCobrado(tx, "99.00", MARZO);

      const { resumen } = await ingresos("12-meses");
      expect(resumen).toMatchObject({ netoCentimos: 0, facturas: 0 });
    }));

  it("respeta las fronteras de mes en Europe/Madrid", () =>
    enTransaccion(async (tx) => {
      // 31/01/2031 23:30 en Madrid (UTC+1) = 22:30 UTC: es de enero.
      const nochePeninsular = new Date("2031-01-31T22:30:00Z");
      await facturar(tx, await pedidoCobrado(tx, "20.00", nochePeninsular), nochePeninsular);
      // 01/02/2031 00:30 en Madrid = 23:30 UTC del 31: ya es de febrero.
      const madrugada = new Date("2031-01-31T23:30:00Z");
      await facturar(tx, await pedidoCobrado(tx, "7.00", madrugada), madrugada);

      const { porMes } = await ingresos("12-meses");
      expect(porMes["2031-01"]).toBe(2_000);
      expect(porMes["2031-02"]).toBe(700);

      const enFebrero = await ingresos("mes-anterior", new Date("2031-02-10T10:00:00Z"));
      expect(enFebrero.resumen.netoCentimos).toBe(2_000);
    }));
});

describe("pedidos perdidos y pendientes de cobro", () => {
  it("cancelados y caducados se cuentan aparte, por updatedAt", () =>
    enTransaccion(async (tx) => {
      const { contarPedidosPerdidos } = await import("@/server/data/dashboard");
      const cliente = await crearUsuario(tx, "cliente");
      const pedido = (status: "cancelado" | "caducado", updatedAt: Date) =>
        tx.order.create({ data: { userId: cliente.id, total: "10.00", status, updatedAt } });

      await pedido("cancelado", MARZO);
      await pedido("caducado", MARZO);
      await pedido("caducado", MARZO);
      await pedido("cancelado", ENERO);

      expect(await contarPedidosPerdidos(periodoDesdeParam("mes-actual", AHORA))).toEqual({
        cancelados: 1,
        caducados: 2,
      });
      expect(await contarPedidosPerdidos(periodoDesdeParam("12-meses", AHORA))).toEqual({
        cancelados: 2,
        caducados: 2,
      });
    }));

  it("pendientes: listas con importe final > 0 y sin cobro, también en el listado", () =>
    enTransaccion(async (tx) => {
      const { resumirPendientesCobro } = await import("@/server/data/dashboard");
      const { listarSolicitudesAdmin } = await import("@/server/data/admin-requests");
      const antes = await resumirPendientesCobro();
      const cliente = await crearUsuario(tx, "cliente");

      const lista = async (budgetAmount: string, cobrada: boolean) => {
        const solicitud = await crearSolicitud(tx, { clientId: cliente.id, status: "lista" });
        await crearPresupuesto(tx, { requestId: solicitud.id, status: "aceptado", budgetAmount });
        if (cobrada) {
          const presupuesto = await tx.quote.findUniqueOrThrow({ where: { requestId: solicitud.id } });
          await tx.serviceRequest.update({
            where: { id: solicitud.id },
            data: { paidAt: new Date(), paidAmount: presupuesto.finalAmount, paymentMethod: "efectivo" },
          });
        }

        return solicitud.id;
      };

      const pendiente = await lista("120.00", false); // 90 €
      await lista("150.00", true); // cobrada
      await lista("30.00", false); // importe final 0: no hay nada que cobrar

      const despues = await resumirPendientesCobro();
      expect(despues.total - antes.total).toBe(1);
      expect(despues.importeCentimos - antes.importeCentimos).toBe(9_000);

      const listado = await listarSolicitudesAdmin(undefined, { soloPendientesCobro: true });
      expect(listado.map((s) => s.id)).toContain(pendiente);
      expect(listado).toHaveLength(despues.total);
    }));
});
