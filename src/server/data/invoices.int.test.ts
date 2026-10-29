import { describe, expect, it } from "vitest";

import {
  conSavepoint,
  crearPresupuesto,
  crearProducto,
  crearSolicitud,
  crearUsuario,
  enTransaccion,
  type Tx,
} from "@/test/integration/db";

async function staff(tx: Tx, role: "encargado" | "admin" = "encargado") {
  const usuario = await crearUsuario(tx, role);

  return { id: usuario.id, role };
}

/** Pedido pendiente de 2 × 29,95 € (59,90 €) de un cliente nuevo. */
async function pedidoPendiente(tx: Tx) {
  const pedidos = await import("@/server/data/orders");
  const cliente = await crearUsuario(tx, "cliente", "Cliente Factura");
  const producto = await crearProducto(tx, { stock: 5, price: "29.95", name: "Teclado int" });
  const resultado = await pedidos.crearPedidoCliente(
    cliente.id,
    [{ productId: producto.id, quantity: 2 }],
    `k-${producto.id}`,
  );
  if (!resultado.ok) throw new Error("checkout fallido");

  return { orderId: resultado.pedidoId, cliente };
}

async function pedidoCobrado(tx: Tx, importe = 59.9, quien?: { id: string; role: "encargado" | "admin" }) {
  const cobros = await import("@/server/data/payments");
  const datos = await pedidoPendiente(tx);
  const cobrador = quien ?? (await staff(tx));
  const resultado = await cobros.registrarCobroPedido({
    id: datos.orderId,
    importe,
    metodo: "bizum",
    nota: importe === 59.9 ? null : "Ajuste acordado con el cliente",
    staff: cobrador,
  });
  if (!resultado.ok) throw new Error(`cobro fallido: ${resultado.motivo}`);

  return { ...datos, staff: cobrador };
}

async function facturasDe(tx: Tx, where: { orderId?: string; requestId?: string }) {
  return tx.invoice.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { lines: { orderBy: { position: "asc" } } },
  });
}

describe("emisión al cobrar", () => {
  it("el cobro de un pedido emite una FAC simplificada con su desglose", () =>
    enTransaccion(async (tx) => {
      const { orderId, cliente } = await pedidoCobrado(tx);
      const [factura] = await facturasDe(tx, { orderId });

      expect(factura.code).toMatch(/^FAC-\d{4}-\d{4,}$/);
      expect(factura).toMatchObject({
        series: "FAC",
        kind: "ordinaria",
        concept: "venta",
        mode: "simplificada",
        isBackfill: false,
        customerId: cliente.id,
        customerName: "Cliente Factura",
        customerTaxId: null,
        paymentMethod: "bizum",
        issuerTaxId: "B00000000",
      });
      expect(factura.total.toString()).toBe("59.9");
      expect(Number(factura.baseTotal) + Number(factura.vatTotal)).toBeCloseTo(59.9, 2);
      expect(factura.vatRate.toString()).toBe("21");
      expect(factura.lines).toHaveLength(1);
      expect(factura.lines[0]).toMatchObject({ description: "Teclado int", quantity: 2 });

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(factura.issuedAt).toEqual(pedido.paidAt);
    }));

  it("si el admin cobra otro importe, la factura añade el ajuste y suma lo cobrado", () =>
    enTransaccion(async (tx) => {
      const admin = await staff(tx, "admin");
      const { orderId } = await pedidoCobrado(tx, 55, admin);
      const [factura] = await facturasDe(tx, { orderId });

      expect(factura.total.toString()).toBe("55");
      expect(factura.lines.at(-1)).toMatchObject({ description: "Ajuste de importe" });
      expect(factura.lines.at(-1)?.lineTotal.toString()).toBe("-4.9");
    }));

  it("una reparación con NIF y domicilio se factura completa, con descuento del diagnóstico", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const cliente = await crearUsuario(tx, "cliente", "Cliente Completa");
      await tx.user.update({ where: { id: cliente.id }, data: { nif: "12345678Z" } });
      const solicitud = await crearSolicitud(tx, {
        clientId: cliente.id,
        status: "lista",
        modality: "domicilio",
        address: "Calle Falsa 123, Madrid",
      });
      await crearPresupuesto(tx, { requestId: solicitud.id, status: "aceptado" });

      await cobros.registrarCobroSolicitud({
        id: solicitud.id,
        importe: 90,
        metodo: "efectivo",
        nota: null,
        staff: await staff(tx),
      });

      const [factura] = await facturasDe(tx, { requestId: solicitud.id });
      expect(factura).toMatchObject({
        concept: "reparacion",
        mode: "completa",
        customerTaxId: "12345678Z",
        customerAddress: "Calle Falsa 123, Madrid",
      });
      expect(factura.lines.map((linea) => linea.lineTotal.toString())).toEqual(["120", "-30"]);
      expect(factura.total.toString()).toBe("90");
    }));

  it("el cobro del diagnóstico de una rechazada se factura como diagnóstico", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const cliente = await crearUsuario(tx, "cliente");
      const solicitud = await crearSolicitud(tx, { clientId: cliente.id, status: "rechazada" });
      await crearPresupuesto(tx, { requestId: solicitud.id, status: "rechazado" });

      await cobros.registrarCobroSolicitud({
        id: solicitud.id,
        importe: 30,
        metodo: "efectivo",
        nota: null,
        staff: await staff(tx),
      });

      const [factura] = await facturasDe(tx, { requestId: solicitud.id });
      expect(factura.concept).toBe("diagnostico");
      expect(factura.lines.map((linea) => linea.description)).toEqual(["Diagnóstico"]);
    }));
});

describe("numeración e inmutabilidad", () => {
  it("es correlativa y una transacción fallida no deja hueco", () =>
    enTransaccion(async (tx) => {
      const facturas = await import("@/server/data/invoices");
      const primero = await pedidoCobrado(tx);
      const [a] = await facturasDe(tx, { orderId: primero.orderId });

      // Una emisión que se revierte consume número dentro de su savepoint y lo devuelve.
      await expect(
        conSavepoint(tx, async () => {
          await facturas.emitirFacturaDeCobroEnTx(tx, { tipo: "pedido", id: primero.orderId }, new Date());
          throw new Error("fallo simulado");
        }),
      ).rejects.toThrow("fallo simulado");

      const segundo = await pedidoCobrado(tx);
      const [b] = await facturasDe(tx, { orderId: segundo.orderId });

      expect(b.year).toBe(a.year);
      expect(b.number).toBe(a.number + 1);
    }));

  it("una factura no se puede modificar ni borrar, tampoco sus líneas", () =>
    enTransaccion(async (tx) => {
      const { orderId } = await pedidoCobrado(tx);
      const [factura] = await facturasDe(tx, { orderId });

      await expect(
        conSavepoint(tx, () => tx.invoice.update({ where: { id: factura.id }, data: { customerName: "X" } })),
      ).rejects.toThrow(/inmutables/);
      await expect(
        conSavepoint(tx, () => tx.invoice.delete({ where: { id: factura.id } })),
      ).rejects.toThrow(/inmutables/);
      await expect(
        conSavepoint(tx, () =>
          tx.invoiceLine.update({ where: { id: factura.lines[0].id }, data: { description: "X" } }),
        ),
      ).rejects.toThrow(/inmutables/);
      await expect(
        conSavepoint(tx, () => tx.$executeRawUnsafe(`UPDATE "invoices" SET "total" = 0 WHERE "id" = '${factura.id}'`)),
      ).rejects.toThrow(/inmutables/);
    }));

  it("ni con el permiso de borrado se puede modificar una factura", () =>
    enTransaccion(async (tx) => {
      const { orderId } = await pedidoCobrado(tx);
      const [factura] = await facturasDe(tx, { orderId });
      await tx.$executeRawUnsafe("SET LOCAL softhard.permitir_borrado_facturas = 'on'");

      await expect(
        conSavepoint(tx, () => tx.invoice.update({ where: { id: factura.id }, data: { customerName: "X" } })),
      ).rejects.toThrow(/inmutables/);
    }));
});

describe("rectificativas, bloqueos y re-emisión", () => {
  it("la rectificativa es el negativo exacto, no toca el cobro y no se repite", () =>
    enTransaccion(async (tx) => {
      const facturas = await import("@/server/data/invoices");
      const { orderId, staff: encargado } = await pedidoCobrado(tx);
      const [original] = await facturasDe(tx, { orderId });
      const pedidoAntes = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

      const resultado = await facturas.emitirRectificativa({
        invoiceId: original.id,
        motivo: "Cliente con datos erróneos",
        staffId: encargado.id,
      });
      expect(resultado.ok).toBe(true);

      const [, rect] = await facturasDe(tx, { orderId });
      expect(rect).toMatchObject({
        series: "RECT",
        kind: "rectificativa",
        rectifiesInvoiceId: original.id,
        reason: "Cliente con datos erróneos",
        issuedById: encargado.id,
      });
      expect(Number(rect.total)).toBe(-Number(original.total));
      expect(Number(rect.baseTotal)).toBe(-Number(original.baseTotal));
      expect(Number(rect.vatTotal)).toBe(-Number(original.vatTotal));

      const pedidoDespues = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pedidoDespues).toEqual(pedidoAntes);

      await expect(
        facturas.emitirRectificativa({ invoiceId: original.id, motivo: "Otra vez", staffId: encargado.id }),
      ).resolves.toEqual({ ok: false, motivo: "no-vigente" });
      await expect(
        facturas.emitirRectificativa({ invoiceId: rect.id, motivo: "Rectificar la rect", staffId: encargado.id }),
      ).resolves.toEqual({ ok: false, motivo: "no-vigente" });
    }));

  it("un pedido con factura vigente no se cancela hasta rectificarla", () =>
    enTransaccion(async (tx) => {
      const admin = await import("@/server/data/admin-orders");
      const facturas = await import("@/server/data/invoices");
      const { orderId, staff: encargado } = await pedidoCobrado(tx);
      const cancelar = () =>
        admin.cambiarEstadoPedidoAdmin({
          orderId,
          estadoEsperado: "pagado",
          estadoNuevo: "cancelado",
          userId: encargado.id,
          motivo: "El cliente lo devuelve",
        });

      await expect(cancelar()).resolves.toEqual({ ok: false, motivo: "factura-vigente" });
      expect((await tx.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("pagado");

      const [original] = await facturasDe(tx, { orderId });
      await facturas.emitirRectificativa({ invoiceId: original.id, motivo: "Devolución", staffId: encargado.id });

      await expect(cancelar()).resolves.toMatchObject({ ok: true });
    }));

  it("una solicitud con factura vigente solo puede entregarse; el resto espera a la rectificativa", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const estados = await import("@/server/data/service-status");
      const facturas = await import("@/server/data/invoices");
      const encargado = await staff(tx);
      const cliente = await crearUsuario(tx, "cliente");
      const solicitud = await crearSolicitud(tx, { clientId: cliente.id, status: "lista" });
      await crearPresupuesto(tx, { requestId: solicitud.id, status: "aceptado" });
      await cobros.registrarCobroSolicitud({
        id: solicitud.id,
        importe: 90,
        metodo: "efectivo",
        nota: null,
        staff: encargado,
      });

      await expect(
        estados.cambiarEstadoSolicitud({
          requestId: solicitud.id,
          estadoEsperado: "lista",
          estadoNuevo: "en_reparacion",
          actorId: encargado.id,
          rol: "encargado",
          motivo: "Falla otra vez",
        }),
      ).resolves.toEqual({ ok: false, motivo: "factura-vigente" });
      expect((await tx.serviceRequest.findUniqueOrThrow({ where: { id: solicitud.id } })).status).toBe("lista");

      const [original] = await facturasDe(tx, { requestId: solicitud.id });
      await facturas.emitirRectificativa({ invoiceId: original.id, motivo: "Vuelve al taller", staffId: encargado.id });

      await expect(
        estados.cambiarEstadoSolicitud({
          requestId: solicitud.id,
          estadoEsperado: "lista",
          estadoNuevo: "en_reparacion",
          actorId: encargado.id,
          rol: "encargado",
          motivo: "Falla otra vez",
        }),
      ).resolves.toEqual({ ok: true });
    }));

  it("con factura vigente, entregar lo cobrado sí se permite", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const estados = await import("@/server/data/service-status");
      const encargado = await staff(tx);
      const cliente = await crearUsuario(tx, "cliente");
      const solicitud = await crearSolicitud(tx, { clientId: cliente.id, status: "lista" });
      await crearPresupuesto(tx, { requestId: solicitud.id, status: "aceptado" });
      await cobros.registrarCobroSolicitud({ id: solicitud.id, importe: 90, metodo: "efectivo", nota: null, staff: encargado });

      await expect(
        estados.cambiarEstadoSolicitud({
          requestId: solicitud.id,
          estadoEsperado: "lista",
          estadoNuevo: "entregada",
          actorId: encargado.id,
          rol: "encargado",
        }),
      ).resolves.toEqual({ ok: true });
    }));

  it("re-emitir crea una FAC con los datos actuales del cliente y el tipo de la sustituida", () =>
    enTransaccion(async (tx) => {
      const facturas = await import("@/server/data/invoices");
      const { orderId, cliente, staff: encargado } = await pedidoCobrado(tx);
      const [original] = await facturasDe(tx, { orderId });
      const entidad = { tipo: "pedido" as const, id: orderId };

      await expect(
        facturas.reemitirFactura({ entidad, motivo: "Sin rectificar todavía", staffId: encargado.id }),
      ).resolves.toEqual({ ok: false, motivo: "no-permitida" });

      await facturas.emitirRectificativa({ invoiceId: original.id, motivo: "NIF erróneo", staffId: encargado.id });
      await tx.user.update({ where: { id: cliente.id }, data: { nif: "X1234567L" } });

      const resultado = await facturas.reemitirFactura({
        entidad,
        motivo: "El cliente aporta su NIE",
        staffId: encargado.id,
      });
      expect(resultado.ok).toBe(true);

      const todas = await facturasDe(tx, { orderId });
      const nueva = todas.at(-1)!;
      expect(nueva).toMatchObject({
        series: "FAC",
        mode: "completa",
        customerTaxId: "X1234567L",
        replacesInvoiceId: original.id,
        reissueReason: "El cliente aporta su NIE",
        issuedById: encargado.id,
      });
      expect(nueva.total.toString()).toBe(original.total.toString());
      expect(nueva.vatRate.toString()).toBe(original.vatRate.toString());

      await expect(
        facturas.reemitirFactura({ entidad, motivo: "Una segunda vez", staffId: encargado.id }),
      ).resolves.toEqual({ ok: false, motivo: "no-permitida" });
    }));

  it("un pedido cancelado no se re-emite", () =>
    enTransaccion(async (tx) => {
      const facturas = await import("@/server/data/invoices");
      const admin = await import("@/server/data/admin-orders");
      const { orderId, staff: encargado } = await pedidoCobrado(tx);
      const [original] = await facturasDe(tx, { orderId });
      await facturas.emitirRectificativa({ invoiceId: original.id, motivo: "Devolución", staffId: encargado.id });
      await admin.cambiarEstadoPedidoAdmin({
        orderId,
        estadoEsperado: "pagado",
        estadoNuevo: "cancelado",
        userId: encargado.id,
        motivo: "Devolución",
      });

      await expect(
        facturas.reemitirFactura({
          entidad: { tipo: "pedido", id: orderId },
          motivo: "No debería poder",
          staffId: encargado.id,
        }),
      ).resolves.toEqual({ ok: false, motivo: "no-permitida" });
    }));

  it("un cliente no ve facturas ajenas", () =>
    enTransaccion(async (tx) => {
      const facturas = await import("@/server/data/invoices");
      const { orderId, cliente } = await pedidoCobrado(tx);
      const otro = await crearUsuario(tx, "cliente");
      const [factura] = await facturasDe(tx, { orderId });

      await expect(facturas.obtenerFacturaCliente(factura.id, otro.id)).resolves.toBeNull();
      await expect(facturas.obtenerFacturaCliente(factura.id, cliente.id)).resolves.toMatchObject({
        id: factura.id,
      });
      expect(await facturas.listarFacturasCliente(otro.id)).toEqual([]);
    }));
});
