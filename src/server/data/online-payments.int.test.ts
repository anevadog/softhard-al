import { describe, expect, it } from "vitest";

import {
  crearPresupuesto,
  crearProducto,
  crearSolicitud,
  crearUsuario,
  enTransaccion,
  type Tx,
} from "@/test/integration/db";
import { MockPaymentProvider } from "@/server/providers/payments";

/** Pasarela simulada (5.3) contra PostgreSQL real. */

async function pedidoPendiente(tx: Tx) {
  const { crearPedidoCliente } = await import("@/server/data/orders");
  const cliente = await crearUsuario(tx, "cliente");
  const producto = await crearProducto(tx, { stock: 5, price: "29.95", name: "Ratón pasarela" });
  const resultado = await crearPedidoCliente(cliente.id, [{ productId: producto.id, quantity: 2 }], `k-pago-${producto.id}`);
  if (!resultado.ok) throw new Error("checkout fallido");

  return { cliente, orderId: resultado.pedidoId };
}

/** Reparación en `lista` con presupuesto aceptado (120 − 30 = 90 €). */
async function reparacionLista(tx: Tx, budgetAmount = "120.00") {
  const cliente = await crearUsuario(tx, "cliente");
  const solicitud = await crearSolicitud(tx, { clientId: cliente.id, status: "lista" });
  await crearPresupuesto(tx, { requestId: solicitud.id, status: "aceptado", budgetAmount });

  return { cliente, requestId: solicitud.id };
}

/** Crea la sesión y devuelve su referencia en el proveedor. */
async function iniciar(
  tx: Tx,
  provider: MockPaymentProvider,
  entidad: { tipo: "pedido" | "solicitud"; id: string },
  clienteId: string,
) {
  const { iniciarPago } = await import("@/server/data/online-payments");
  const resultado = await iniciarPago({ entidad, clienteId, provider });
  if (!resultado.ok) throw new Error(`no se pudo iniciar: ${resultado.motivo}`);

  const id = resultado.urlPago.split("/").at(-1) as string;
  const sesion = await tx.paymentSession.findUniqueOrThrow({ where: { id } });

  return sesion;
}

async function confirmar(provider: MockPaymentProvider, referencia: string, resultado: "pagado" | "fallido" | "abandonado" = "pagado") {
  const { confirmarPago } = await import("@/server/data/online-payments");

  return confirmarPago({ referencia, resultado }, provider);
}

describe("pago correcto", () => {
  it("de un pedido: sesión completada, pedido pagado con tarjeta y FAC sin ajuste", () =>
    enTransaccion(async (tx) => {
      const provider = new MockPaymentProvider();
      const { cliente, orderId } = await pedidoPendiente(tx);
      const sesion = await iniciar(tx, provider, { tipo: "pedido", id: orderId }, cliente.id);

      expect(sesion).toMatchObject({ provider: "mock", status: "pendiente", amountCentimos: 5_990, customerId: cliente.id });
      expect(await confirmar(provider, sesion.providerRef)).toEqual({
        estado: "completada",
        returnPath: `/app/pedidos/${orderId}`,
      });

      const pedido = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { invoices: { include: { lines: true } } },
      });
      expect(pedido).toMatchObject({ status: "pagado", paymentMethod: "tarjeta_online", paidById: null, paymentNote: null });
      expect(pedido.paidAmount?.toString()).toBe("59.9");
      expect(pedido.invoices).toHaveLength(1);
      expect(pedido.invoices[0]).toMatchObject({ series: "FAC", isBackfill: false, paymentMethod: "tarjeta_online" });
      expect(pedido.invoices[0]?.issuedAt).toEqual(pedido.paidAt);
      expect(pedido.invoices[0]?.lines.map((l) => l.description)).not.toContain("Ajuste de importe");

      const completada = await tx.paymentSession.findUniqueOrThrow({ where: { id: sesion.id } });
      expect(completada.completedAt).toEqual(pedido.paidAt);
    }));

  it("de una reparación lista: cobro y factura, sin cambiar el estado", () =>
    enTransaccion(async (tx) => {
      const provider = new MockPaymentProvider();
      const { cliente, requestId } = await reparacionLista(tx);
      const sesion = await iniciar(tx, provider, { tipo: "solicitud", id: requestId }, cliente.id);

      expect(sesion.amountCentimos).toBe(9_000);
      expect((await confirmar(provider, sesion.providerRef))?.estado).toBe("completada");

      const solicitud = await tx.serviceRequest.findUniqueOrThrow({ where: { id: requestId }, include: { invoices: true } });
      expect(solicitud).toMatchObject({ status: "lista", paymentMethod: "tarjeta_online", paidById: null });
      expect(solicitud.paidAmount?.toString()).toBe("90");
      expect(solicitud.invoices.map((f) => [f.series, f.concept])).toEqual([["FAC", "reparacion"]]);
    }));
});

describe("error, abandono e idempotencia", () => {
  it("error y abandono dejan el pedido pendiente y se puede reintentar con otra sesión", () =>
    enTransaccion(async (tx) => {
      const provider = new MockPaymentProvider();
      const { cliente, orderId } = await pedidoPendiente(tx);
      const entidad = { tipo: "pedido" as const, id: orderId };

      const conError = await iniciar(tx, provider, entidad, cliente.id);
      expect((await confirmar(provider, conError.providerRef, "fallido"))?.estado).toBe("fallida");
      const abandonada = await iniciar(tx, provider, entidad, cliente.id);
      expect((await confirmar(provider, abandonada.providerRef, "abandonado"))?.estado).toBe("abandonada");

      expect((await tx.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("pendiente");

      const reintento = await iniciar(tx, provider, entidad, cliente.id);
      expect((await confirmar(provider, reintento.providerRef))?.estado).toBe("completada");
      expect(await tx.paymentSession.count({ where: { orderId } })).toBe(3);
    }));

  it("una doble confirmación no cobra ni factura dos veces", () =>
    enTransaccion(async (tx) => {
      const provider = new MockPaymentProvider();
      const { cliente, orderId } = await pedidoPendiente(tx);
      const sesion = await iniciar(tx, provider, { tipo: "pedido", id: orderId }, cliente.id);

      await confirmar(provider, sesion.providerRef);
      expect((await confirmar(provider, sesion.providerRef))?.estado).toBe("completada");
      // Tampoco un "fallido" posterior cambia una sesión ya cerrada.
      expect((await confirmar(provider, sesion.providerRef, "fallido"))?.estado).toBe("completada");

      expect(await tx.invoice.count({ where: { orderId } })).toBe(1);
      expect(provider.reembolsos).toEqual([]);
    }));

  it("una referencia desconocida no hace nada", () =>
    enTransaccion(async () => {
      expect(await confirmar(new MockPaymentProvider(), "mock_no-existe")).toBeNull();
    }));
});

describe("pagos que llegan tarde: se reembolsan", () => {
  it("sobre un pedido caducado: no se toca el pedido y la sesión se reembolsa", () =>
    enTransaccion(async (tx) => {
      const provider = new MockPaymentProvider();
      const { cliente, orderId } = await pedidoPendiente(tx);
      const sesion = await iniciar(tx, provider, { tipo: "pedido", id: orderId }, cliente.id);

      await tx.order.update({ where: { id: orderId }, data: { expiresAt: new Date(Date.now() - 60_000) } });

      expect((await confirmar(provider, sesion.providerRef))?.estado).toBe("reembolsada");
      expect(provider.reembolsos).toEqual([sesion.providerRef]);

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pedido).toMatchObject({ status: "pendiente", paidAt: null });
      expect(await tx.invoice.count({ where: { orderId } })).toBe(0);
      const reembolsada = await tx.paymentSession.findUniqueOrThrow({ where: { id: sesion.id } });
      expect(reembolsada.refundReason).toBeTruthy();
      expect(reembolsada.completedAt).toBeNull();
    }));

  it("con dos sesiones abiertas, la segunda confirmación se reembolsa", () =>
    enTransaccion(async (tx) => {
      const provider = new MockPaymentProvider();
      const { cliente, requestId } = await reparacionLista(tx);
      const entidad = { tipo: "solicitud" as const, id: requestId };
      const primera = await iniciar(tx, provider, entidad, cliente.id);
      const segunda = await iniciar(tx, provider, entidad, cliente.id);

      expect((await confirmar(provider, primera.providerRef))?.estado).toBe("completada");
      expect((await confirmar(provider, segunda.providerRef))?.estado).toBe("reembolsada");
      expect(await tx.invoice.count({ where: { requestId } })).toBe(1);
    }));

  it("si el staff ya lo cobró a mano, la pasarela no toca nada y reembolsa", () =>
    enTransaccion(async (tx) => {
      const { registrarCobroPedido } = await import("@/server/data/payments");
      const provider = new MockPaymentProvider();
      const { cliente, orderId } = await pedidoPendiente(tx);
      const encargado = await crearUsuario(tx, "encargado");
      const sesion = await iniciar(tx, provider, { tipo: "pedido", id: orderId }, cliente.id);

      expect(
        await registrarCobroPedido({
          id: orderId,
          importe: 59.9,
          metodo: "efectivo",
          nota: null,
          staff: { id: encargado.id, role: "encargado" },
        }),
      ).toEqual({ ok: true });

      expect((await confirmar(provider, sesion.providerRef))?.estado).toBe("reembolsada");
      const pedido = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pedido).toMatchObject({ paymentMethod: "efectivo", paidById: encargado.id });
    }));

  it("un importe que no coincide con el esperado se reembolsa", () =>
    enTransaccion(async (tx) => {
      const provider = new MockPaymentProvider();
      const { cliente, orderId } = await pedidoPendiente(tx);
      const sesion = await iniciar(tx, provider, { tipo: "pedido", id: orderId }, cliente.id);

      await tx.paymentSession.update({ where: { id: sesion.id }, data: { amountCentimos: 100 } });

      expect((await confirmar(provider, sesion.providerRef))?.estado).toBe("reembolsada");
      expect((await tx.order.findUniqueOrThrow({ where: { id: orderId } })).paidAt).toBeNull();
    }));
});

describe("cancelación de un pedido cobrado por pasarela", () => {
  it("bloqueada sin rectificativa; con ella, cancela y reembolsa sin tocar el cobro", () =>
    enTransaccion(async (tx) => {
      const { cambiarEstadoPedidoAdmin } = await import("@/server/data/admin-orders");
      const { emitirRectificativa } = await import("@/server/data/invoices");
      const { obtenerPaymentProvider } = await import("@/server/providers/payments");
      const provider = obtenerPaymentProvider() as MockPaymentProvider;
      const { cliente, orderId } = await pedidoPendiente(tx);
      const encargado = await crearUsuario(tx, "encargado");
      const sesion = await iniciar(tx, provider, { tipo: "pedido", id: orderId }, cliente.id);
      await confirmar(provider, sesion.providerRef);

      const cancelar = () =>
        cambiarEstadoPedidoAdmin({
          orderId,
          estadoEsperado: "pagado",
          estadoNuevo: "cancelado",
          userId: encargado.id,
          motivo: "El cliente desiste",
        });

      expect(await cancelar()).toEqual({ ok: false, motivo: "factura-vigente" });
      expect((await tx.paymentSession.findUniqueOrThrow({ where: { id: sesion.id } })).status).toBe("completada");

      const [factura] = await tx.invoice.findMany({ where: { orderId } });
      expect((await emitirRectificativa({ invoiceId: factura!.id, motivo: "Pedido cancelado", staffId: encargado.id })).ok).toBe(true);

      expect((await cancelar()).ok).toBe(true);

      const reembolsada = await tx.paymentSession.findUniqueOrThrow({ where: { id: sesion.id } });
      expect(reembolsada).toMatchObject({ status: "reembolsada" });
      expect(reembolsada.completedAt).not.toBeNull();
      expect(provider.reembolsos).toContain(sesion.providerRef);

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pedido).toMatchObject({ status: "cancelado", paymentMethod: "tarjeta_online" });
      expect(pedido.paidAt).not.toBeNull();
    }));
});

describe("propiedad y qué se puede pagar", () => {
  it("un cliente no puede pagar ni ver la sesión de otro", () =>
    enTransaccion(async (tx) => {
      const { iniciarPago, obtenerSesionMock } = await import("@/server/data/online-payments");
      const provider = new MockPaymentProvider();
      const { cliente, orderId } = await pedidoPendiente(tx);
      const intruso = await crearUsuario(tx, "cliente");

      expect(await iniciarPago({ entidad: { tipo: "pedido", id: orderId }, clienteId: intruso.id, provider })).toEqual({
        ok: false,
        motivo: "no-existe",
      });

      const sesion = await iniciar(tx, provider, { tipo: "pedido", id: orderId }, cliente.id);
      expect(await obtenerSesionMock(sesion.id, intruso.id)).toBeNull();
      expect(await obtenerSesionMock(sesion.id, cliente.id)).toMatchObject({ importeCentimos: 5_990 });
    }));

  it("no se paga online un diagnóstico ni una reparación de 0 €", () =>
    enTransaccion(async (tx) => {
      const { iniciarPago } = await import("@/server/data/online-payments");
      const provider = new MockPaymentProvider();

      const cliente = await crearUsuario(tx, "cliente");
      const rechazada = await crearSolicitud(tx, { clientId: cliente.id, status: "rechazada" });
      await crearPresupuesto(tx, { requestId: rechazada.id, status: "rechazado" });
      expect(
        await iniciarPago({ entidad: { tipo: "solicitud", id: rechazada.id }, clienteId: cliente.id, provider }),
      ).toEqual({ ok: false, motivo: "no-pagable" });

      const gratis = await reparacionLista(tx, "30.00");
      expect(
        await iniciarPago({ entidad: { tipo: "solicitud", id: gratis.requestId }, clienteId: gratis.cliente.id, provider }),
      ).toEqual({ ok: false, motivo: "no-pagable" });
    }));
});
