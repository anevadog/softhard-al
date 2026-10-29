import { describe, expect, it } from "vitest";

import { periodoDesdeParam, resumirIngresos } from "@/lib/dashboard";
import { diaMadrid } from "@/lib/exports";
import { aCentimos } from "@/lib/vat";
import {
  filtrosIngresosSchema,
  filtrosPedidosSchema,
  filtrosReparacionesSchema,
} from "@/lib/validations/exports";
import {
  crearPresupuesto,
  crearProducto,
  crearSolicitud,
  crearUsuario,
  enTransaccion,
  type Tx,
} from "@/test/integration/db";

/** Exportaciones a CSV contra PostgreSQL real; fechas en 2031 para aislarlas. */

const ENERO = new Date("2031-01-15T10:00:00Z");
const FEBRERO = new Date("2031-02-10T10:00:00Z");
const NOTA = "Nota interna del cobro que no debe salir";

async function pedidoFacturado(tx: Tx, precio: string, fecha: Date, serie: "FAC" | "MIG" = "FAC") {
  const { emitirFacturaDeCobroEnTx } = await import("@/server/data/invoices");
  const cliente = await crearUsuario(tx, "cliente", "Cliente; con \"comillas\"");
  const producto = await crearProducto(tx, { stock: 5, price: precio, name: "=Producto raro" });
  const pedido = await tx.order.create({
    data: {
      userId: cliente.id,
      total: precio,
      status: "entregado",
      createdAt: fecha,
      paidAt: fecha,
      paidAmount: precio,
      paymentMethod: "bizum",
      paymentNote: NOTA,
      items: { create: [{ productId: producto.id, quantity: 1, price: precio }] },
    },
  });
  const factura = await emitirFacturaDeCobroEnTx(tx, { tipo: "pedido", id: pedido.id }, fecha, { serie });
  if (!factura) throw new Error("no facturable");

  return { pedido, factura };
}

const rango = (desde: string, hasta: string) => ({ desde, hasta });

describe("ingresos.csv", () => {
  it("la suma del total coincide con el dashboard del mismo periodo", () =>
    enTransaccion(async (tx) => {
      const { filasIngresos } = await import("@/server/data/exports");
      const { obtenerFilasIngresos } = await import("@/server/data/dashboard");
      const { emitirRectificativaEnTx } = await import("@/server/data/invoices");
      const staff = await crearUsuario(tx, "encargado");

      const enero = await pedidoFacturado(tx, "120.00", ENERO);
      await pedidoFacturado(tx, "45.50", FEBRERO, "MIG");
      await pedidoFacturado(tx, "19.99", FEBRERO);
      // Rectificativa en febrero de una factura de enero: resta en febrero.
      await emitirRectificativaEnTx(
        tx,
        { invoiceId: enero.factura.id, motivo: "Error en los datos", staffId: staff.id },
        FEBRERO,
      );

      const periodo = periodoDesdeParam("mes-actual", new Date("2031-02-20T10:00:00Z"));
      const filtros = filtrosIngresosSchema.parse(
        rango(diaMadrid(periodo.inicio), diaMadrid(new Date(periodo.fin.getTime() - 1))),
      );
      const filas = await filasIngresos(filtros);
      const sumaCsv = (filas ?? []).reduce((suma, fila) => suma + aCentimos(Number(fila.total)), 0);
      const dashboard = resumirIngresos(await obtenerFilasIngresos(periodo));

      expect(filas?.map((fila) => fila.series).sort()).toEqual(["FAC", "MIG", "RECT"]);
      expect(sumaCsv).toBe(dashboard.netoCentimos);
      expect(sumaCsv).toBe(4_550 + 1_999 - 12_000);
    }));

  it("filtra por concepto y por serie", () =>
    enTransaccion(async (tx) => {
      const { filasIngresos } = await import("@/server/data/exports");
      await pedidoFacturado(tx, "10.00", ENERO, "MIG");
      await pedidoFacturado(tx, "20.00", ENERO);

      const base = rango("2031-01-01", "2031-01-31");
      expect(await filasIngresos(filtrosIngresosSchema.parse({ ...base, serie: "MIG" }))).toHaveLength(1);
      expect(await filasIngresos(filtrosIngresosSchema.parse({ ...base, concepto: "reparacion" }))).toEqual([]);
    }));

  it("con más filas que el tope devuelve null en lugar de truncar", () =>
    enTransaccion(async (tx) => {
      const { filasIngresos } = await import("@/server/data/exports");
      for (const precio of ["1.00", "2.00", "3.00"]) {
        await pedidoFacturado(tx, precio, ENERO);
      }

      const filtros = filtrosIngresosSchema.parse(rango("2031-01-01", "2031-01-31"));
      expect(await filasIngresos(filtros, 2)).toBeNull();
      expect(await filasIngresos(filtros, 3)).toHaveLength(3);
    }));
});

describe("pedidos.csv y reparaciones.csv", () => {
  it("pedidos: una fila por línea, filtro de estado y sin la nota del cobro", () =>
    enTransaccion(async (tx) => {
      const { filasPedidos } = await import("@/server/data/exports");
      const { pedido } = await pedidoFacturado(tx, "15.00", ENERO);

      const base = rango("2031-01-01", "2031-01-31");
      const filas = await filasPedidos(filtrosPedidosSchema.parse(base));
      expect(filas).toHaveLength(1);
      expect(filas?.[0]?.order.id).toBe(pedido.id);
      expect(JSON.stringify(filas)).not.toContain(NOTA);

      expect(await filasPedidos(filtrosPedidosSchema.parse({ ...base, estado: "cancelado" }))).toEqual([]);
      expect(await filasPedidos(filtrosPedidosSchema.parse(rango("2031-02-01", "2031-02-28")))).toEqual([]);
    }));

  it("reparaciones: por fecha de entrada y estado, con presupuesto y cobro", () =>
    enTransaccion(async (tx) => {
      const { filasReparaciones } = await import("@/server/data/exports");
      const cliente = await crearUsuario(tx, "cliente");
      const solicitud = await crearSolicitud(tx, { clientId: cliente.id, status: "entregada" });
      await crearPresupuesto(tx, { requestId: solicitud.id, status: "aceptado" });
      await tx.serviceRequest.update({
        where: { id: solicitud.id },
        data: { createdAt: ENERO, paidAt: ENERO, paidAmount: "90.00", paymentMethod: "efectivo", paymentNote: NOTA },
      });

      const base = rango("2031-01-01", "2031-01-31");
      const [fila] = (await filasReparaciones(filtrosReparacionesSchema.parse({ ...base, estado: "entregada" }))) ?? [];
      expect(fila).toMatchObject({ id: solicitud.id, status: "entregada", paymentMethod: "efectivo" });
      expect(fila?.quote?.finalAmount?.toString()).toBe("90");
      expect(JSON.stringify(fila)).not.toContain(NOTA);

      expect(await filasReparaciones(filtrosReparacionesSchema.parse({ ...base, estado: "lista" }))).toEqual([]);
    }));
});
