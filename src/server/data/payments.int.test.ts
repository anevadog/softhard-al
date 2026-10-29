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

async function pedidoPendiente(tx: Tx) {
  const pedidos = await import("@/server/data/orders");
  const cliente = await crearUsuario(tx, "cliente");
  const producto = await crearProducto(tx, { stock: 5, price: "29.95" });
  const resultado = await pedidos.crearPedidoCliente(
    cliente.id,
    [{ productId: producto.id, quantity: 2 }],
    `k-${producto.id}`,
  );
  if (!resultado.ok) throw new Error("checkout fallido");

  return resultado.pedidoId;
}

async function staff(tx: Tx, role: "encargado" | "admin" = "encargado") {
  const usuario = await crearUsuario(tx, role);

  return { id: usuario.id, role };
}

describe("cobro de pedidos contra PostgreSQL", () => {
  it("registrar el cobro pasa el pedido a pagado con importe, método, autor y nota", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const orderId = await pedidoPendiente(tx);
      const encargado = await staff(tx);

      await expect(
        cobros.registrarCobroPedido({
          id: orderId,
          importe: 59.9,
          metodo: "bizum",
          nota: "Ref. 1234",
          staff: encargado,
        }),
      ).resolves.toEqual({ ok: true });

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pedido.status).toBe("pagado");
      expect(pedido.paidAt).toBeInstanceOf(Date);
      expect(pedido.paidAmount?.toString()).toBe("59.9");
      expect(pedido.paymentMethod).toBe("bizum");
      expect(pedido.paidById).toBe(encargado.id);
      expect(pedido.paymentNote).toBe("Ref. 1234");
    }));

  it("un segundo registro no cobra dos veces", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const orderId = await pedidoPendiente(tx);
      const encargado = await staff(tx);
      const datos = { id: orderId, importe: 59.9, metodo: "efectivo" as const, nota: null, staff: encargado };

      await cobros.registrarCobroPedido(datos);
      await expect(cobros.registrarCobroPedido(datos)).resolves.toEqual({
        ok: false,
        motivo: "ya-cobrado",
      });
    }));

  it("no cobra un pedido vencido ni uno cancelado", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const encargado = await staff(tx);
      const vencido = await pedidoPendiente(tx);
      await tx.order.update({
        where: { id: vencido },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      const cancelado = await pedidoPendiente(tx);
      await tx.order.update({ where: { id: cancelado }, data: { status: "cancelado" } });

      await expect(
        cobros.registrarCobroPedido({ id: vencido, importe: 59.9, metodo: "efectivo", nota: null, staff: encargado }),
      ).resolves.toEqual({ ok: false, motivo: "caducado" });
      await expect(
        cobros.registrarCobroPedido({ id: cancelado, importe: 59.9, metodo: "efectivo", nota: null, staff: encargado }),
      ).resolves.toEqual({ ok: false, motivo: "no-cobrable" });

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: vencido } });
      expect(pedido.paidAt).toBeNull();
    }));

  it("solo admin cobra otro importe y con motivo", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const orderId = await pedidoPendiente(tx);
      const encargado = await staff(tx);
      const admin = await staff(tx, "admin");
      const base = { id: orderId, importe: 50, metodo: "efectivo" as const };

      await expect(
        cobros.registrarCobroPedido({ ...base, nota: "Descuento cliente habitual", staff: encargado }),
      ).resolves.toEqual({ ok: false, motivo: "importe-no-permitido" });
      await expect(
        cobros.registrarCobroPedido({ ...base, nota: null, staff: admin }),
      ).resolves.toEqual({ ok: false, motivo: "motivo-obligatorio" });
      await expect(
        cobros.registrarCobroPedido({ ...base, nota: "Descuento cliente habitual", staff: admin }),
      ).resolves.toEqual({ ok: true });

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pedido.paidAmount?.toString()).toBe("50");
    }));
});

describe("cobro de solicitudes y entrega contra PostgreSQL", () => {
  async function reparacion(tx: Tx, status: "lista" | "en_reparacion" = "lista", budgetAmount?: string) {
    const cliente = await crearUsuario(tx, "cliente");
    const solicitud = await crearSolicitud(tx, {
      clientId: cliente.id,
      status,
      lastActivityAt: new Date("2026-01-01T00:00:00Z"),
    });
    await crearPresupuesto(tx, { requestId: solicitud.id, status: "aceptado", budgetAmount });

    return solicitud.id;
  }

  it("cobrar una reparación lista no cambia el estado y cuenta como actividad", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const requestId = await reparacion(tx);
      const encargado = await staff(tx);

      await expect(
        cobros.registrarCobroSolicitud({ id: requestId, importe: 90, metodo: "transferencia", nota: null, staff: encargado }),
      ).resolves.toEqual({ ok: true });

      const solicitud = await tx.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
      expect(solicitud.status).toBe("lista");
      expect(solicitud.paidAmount?.toString()).toBe("90");
      expect(solicitud.lastActivityAt.getTime()).toBeGreaterThan(
        new Date("2026-01-01T00:00:00Z").getTime(),
      );
    }));

  it("el cobro del diagnóstico de una rechazada no toca estado ni actividad", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const cliente = await crearUsuario(tx, "cliente");
      const encargado = await staff(tx);
      const actividad = new Date("2026-01-01T00:00:00Z");
      const solicitud = await crearSolicitud(tx, {
        clientId: cliente.id,
        status: "rechazada",
        lastActivityAt: actividad,
      });
      await crearPresupuesto(tx, { requestId: solicitud.id, status: "rechazado" });

      await expect(
        cobros.registrarCobroSolicitud({ id: solicitud.id, importe: 30, metodo: "efectivo", nota: null, staff: encargado }),
      ).resolves.toEqual({ ok: true });

      const actual = await tx.serviceRequest.findUniqueOrThrow({ where: { id: solicitud.id } });
      expect(actual.status).toBe("rechazada");
      expect(actual.paidAmount?.toString()).toBe("30");
      expect(actual.lastActivityAt).toEqual(actividad);
    }));

  it("no hay cobro en estados intermedios ni con importe 0", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const encargado = await staff(tx);
      const enCurso = await reparacion(tx, "en_reparacion");
      const gratis = await reparacion(tx, "lista", "30.00");

      for (const id of [enCurso, gratis]) {
        await expect(
          cobros.registrarCobroSolicitud({ id, importe: 90, metodo: "efectivo", nota: null, staff: encargado }),
        ).resolves.toEqual({ ok: false, motivo: "no-cobrable" });
      }
    }));

  it("entregar exige el cobro, también como corrección del staff", () =>
    enTransaccion(async (tx) => {
      const estados = await import("@/server/data/service-status");
      const cobros = await import("@/server/data/payments");
      const encargado = await staff(tx);
      const lista = await reparacion(tx);
      const enCurso = await reparacion(tx, "en_reparacion");

      await expect(
        estados.cambiarEstadoSolicitud({
          requestId: lista,
          estadoEsperado: "lista",
          estadoNuevo: "entregada",
          actorId: encargado.id,
          rol: "encargado",
        }),
      ).resolves.toEqual({ ok: false, motivo: "requiere-pago" });
      await expect(
        estados.cambiarEstadoSolicitud({
          requestId: enCurso,
          estadoEsperado: "en_reparacion",
          estadoNuevo: "entregada",
          actorId: encargado.id,
          rol: "encargado",
          motivo: "El cliente se la lleva ya",
        }),
      ).resolves.toEqual({ ok: false, motivo: "requiere-pago" });

      await cobros.registrarCobroSolicitud({ id: lista, importe: 90, metodo: "efectivo", nota: null, staff: encargado });
      await expect(
        estados.cambiarEstadoSolicitud({
          requestId: lista,
          estadoEsperado: "lista",
          estadoNuevo: "entregada",
          actorId: encargado.id,
          rol: "encargado",
        }),
      ).resolves.toEqual({ ok: true });
    }));

  it("con importe final 0 se entrega sin cobro", () =>
    enTransaccion(async (tx) => {
      const estados = await import("@/server/data/service-status");
      const encargado = await staff(tx);
      const gratis = await reparacion(tx, "lista", "30.00");

      await expect(
        estados.cambiarEstadoSolicitud({
          requestId: gratis,
          estadoEsperado: "lista",
          estadoNuevo: "entregada",
          actorId: encargado.id,
          rol: "encargado",
        }),
      ).resolves.toEqual({ ok: true });

      const solicitud = await tx.serviceRequest.findUniqueOrThrow({ where: { id: gratis } });
      expect(solicitud.paidAt).toBeNull();
    }));
});

describe("checks del cobro en la base de datos", () => {
  it("rechazan importe 0, método desconocido, cobro sin importe y datos de cobro sin cobro", () =>
    enTransaccion(async (tx) => {
      const orderId = await pedidoPendiente(tx);
      const ahora = new Date();

      for (const data of [
        { paidAt: ahora, paidAmount: "0.00" },
        { paidAt: ahora, paidAmount: "10.00", paymentMethod: "cheque" },
        { paidAt: ahora },
        { paymentMethod: "efectivo" },
      ]) {
        await expect(
          conSavepoint(tx, () => tx.order.update({ where: { id: orderId }, data })),
        ).rejects.toThrow();
      }
    }));
});
