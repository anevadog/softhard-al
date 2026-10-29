import { describe, expect, it } from "vitest";

import {
  crearProducto,
  crearUsuario,
  enTransaccion,
  libroStock,
  type Tx,
} from "@/test/integration/db";

const HORA = 60 * 60 * 1000;

async function vencer(tx: Tx, orderId: string, hace = HORA): Promise<Date> {
  const expiresAt = new Date(Date.now() - hace);
  await tx.order.update({ where: { id: orderId }, data: { expiresAt } });

  return expiresAt;
}

async function movimientos(tx: Tx, productId: string) {
  return tx.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
    select: { reason: true, variation: true, orderId: true, userId: true },
  });
}

describe("checkout contra PostgreSQL", () => {
  it("crea el pedido con caducidad, precios congelados, stock descontado y libro cuadrado", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearUsuario(tx, "cliente");
      const a = await crearProducto(tx, { stock: 5, price: "19.99" });
      const b = await crearProducto(tx, { stock: 3, price: "5.00" });

      const resultado = await pedidos.crearPedidoCliente(
        cliente.id,
        [
          { productId: a.id, quantity: 2 },
          { productId: b.id, quantity: 1 },
        ],
        "clave-1",
      );

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;

      const pedido = await tx.order.findUniqueOrThrow({
        where: { id: resultado.pedidoId },
        include: { items: true },
      });
      expect(pedido.status).toBe("pendiente");
      expect(pedido.total.toString()).toBe("44.98");
      expect(pedido.paidAt).toBeNull();
      // Sin fila de Config en la base de test: 48 h por defecto.
      expect(pedido.expiresAt!.getTime() - pedido.createdAt.getTime()).toBe(48 * HORA);
      expect(pedido.items.map((item) => item.price.toString()).sort()).toEqual(["19.99", "5"]);

      for (const [producto, quedan] of [
        [a, 3],
        [b, 2],
      ] as const) {
        expect(await libroStock(tx, producto.id)).toEqual({ stock: quedan, suma: quedan });
        expect(await movimientos(tx, producto.id)).toContainEqual(
          expect.objectContaining({ reason: "venta", orderId: pedido.id }),
        );
      }
    }));

  it("con stock insuficiente en una línea no escribe nada", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearUsuario(tx, "cliente");
      const a = await crearProducto(tx, { stock: 5 });
      const b = await crearProducto(tx, { stock: 1 });

      const resultado = await pedidos.crearPedidoCliente(
        cliente.id,
        [
          { productId: a.id, quantity: 1 },
          { productId: b.id, quantity: 2 },
        ],
        "clave-1",
      );

      expect(resultado).toEqual({ ok: false, motivo: "stock-insuficiente", productIds: [b.id] });
      expect(await tx.order.count({ where: { userId: cliente.id } })).toBe(0);
      expect(await libroStock(tx, a.id)).toEqual({ stock: 5, suma: 5 });
      expect(await libroStock(tx, b.id)).toEqual({ stock: 1, suma: 1 });
    }));

  it("rechaza productos inactivos o inexistentes sin escribir", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearUsuario(tx, "cliente");
      const archivado = await crearProducto(tx, { stock: 4, active: false });

      await expect(
        pedidos.crearPedidoCliente(cliente.id, [{ productId: archivado.id, quantity: 1 }], "k1"),
      ).resolves.toMatchObject({ ok: false, motivo: "producto-no-disponible" });
      await expect(
        pedidos.crearPedidoCliente(cliente.id, [{ productId: "no-existe", quantity: 1 }], "k2"),
      ).resolves.toMatchObject({ ok: false, motivo: "producto-no-disponible" });

      expect(await tx.order.count({ where: { userId: cliente.id } })).toBe(0);
      expect(await libroStock(tx, archivado.id)).toEqual({ stock: 4, suma: 4 });
    }));

  it("usa el precio de la base aunque haya cambiado desde que se llenó el carrito", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearUsuario(tx, "cliente");
      const producto = await crearProducto(tx, { stock: 2, price: "10.00" });
      await tx.product.update({ where: { id: producto.id }, data: { price: "12.50" } });

      const resultado = await pedidos.crearPedidoCliente(
        cliente.id,
        [{ productId: producto.id, quantity: 2 }],
        "k1",
      );

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      const pedido = await tx.order.findUniqueOrThrow({ where: { id: resultado.pedidoId } });
      expect(pedido.total.toString()).toBe("25");
    }));

  it("la misma clave de idempotencia devuelve el mismo pedido y descuenta una vez", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearUsuario(tx, "cliente");
      const producto = await crearProducto(tx, { stock: 5 });
      const items = [{ productId: producto.id, quantity: 2 }];

      const primero = await pedidos.crearPedidoCliente(cliente.id, items, "misma");
      const segundo = await pedidos.crearPedidoCliente(cliente.id, items, "misma");

      expect(segundo).toEqual(primero);
      expect(await tx.order.count({ where: { userId: cliente.id } })).toBe(1);
      expect(await libroStock(tx, producto.id)).toEqual({ stock: 3, suma: 3 });
    }));

  it("un cliente no ve pedidos ajenos", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const duena = await crearUsuario(tx, "cliente");
      const otra = await crearUsuario(tx, "cliente");
      const producto = await crearProducto(tx, { stock: 1 });
      const resultado = await pedidos.crearPedidoCliente(
        duena.id,
        [{ productId: producto.id, quantity: 1 }],
        "k1",
      );
      if (!resultado.ok) throw new Error("checkout fallido");

      await expect(pedidos.obtenerPedidoCliente(resultado.pedidoId, otra.id)).resolves.toBeNull();
      expect(await pedidos.listarPedidosCliente(otra.id)).toEqual([]);
      await expect(
        pedidos.obtenerPedidoCliente(resultado.pedidoId, duena.id),
      ).resolves.toMatchObject({ id: resultado.pedidoId });
    }));
});

describe("estados del pedido desde el panel contra PostgreSQL", () => {
  async function pedidoPendiente(tx: Tx, stock = 5, cantidad = 2) {
    const pedidos = await import("@/server/data/orders");
    const cliente = await crearUsuario(tx, "cliente");
    const staff = await crearUsuario(tx, "encargado");
    const producto = await crearProducto(tx, { stock });
    const resultado = await pedidos.crearPedidoCliente(
      cliente.id,
      [{ productId: producto.id, quantity: cantidad }],
      `k-${producto.id}`,
    );
    if (!resultado.ok) throw new Error("checkout fallido");

    return { orderId: resultado.pedidoId, producto, staff, cliente };
  }

  it("registrar el cobro rellena paidAt y entregar no lo cambia", () =>
    enTransaccion(async (tx) => {
      const admin = await import("@/server/data/admin-orders");
      const cobros = await import("@/server/data/payments");
      const { orderId, staff } = await pedidoPendiente(tx);

      await expect(
        cobros.registrarCobroPedido({
          id: orderId,
          importe: 20,
          metodo: "efectivo",
          nota: null,
          staff: { id: staff.id, role: "encargado" },
        }),
      ).resolves.toEqual({ ok: true });
      const pagado = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pagado.paidAt).toBeInstanceOf(Date);

      await admin.cambiarEstadoPedidoAdmin({
        orderId,
        estadoEsperado: "pagado",
        estadoNuevo: "entregado",
        userId: staff.id,
        motivo: null,
      });
      const entregado = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(entregado.status).toBe("entregado");
      expect(entregado.paidAt).toEqual(pagado.paidAt);
    }));

  it("cancelar un pendiente o un pagado repone stock una sola vez", () =>
    enTransaccion(async (tx) => {
      const admin = await import("@/server/data/admin-orders");
      const cobros = await import("@/server/data/payments");
      const facturas = await import("@/server/data/invoices");

      for (const cobrar of [false, true]) {
        const { orderId, producto, staff } = await pedidoPendiente(tx);

        if (cobrar) {
          await cobros.registrarCobroPedido({
            id: orderId,
            importe: 20,
            metodo: "efectivo",
            nota: null,
            staff: { id: staff.id, role: "encargado" },
          });
          // Cobrado = facturado: para cancelar hay que rectificar antes la factura.
          const factura = await tx.invoice.findFirstOrThrow({ where: { orderId } });
          await facturas.emitirRectificativa({
            invoiceId: factura.id,
            motivo: "Devolución del pedido",
            staffId: staff.id,
          });
        }

        const cancelar = () =>
          admin.cambiarEstadoPedidoAdmin({
            orderId,
            estadoEsperado: cobrar ? "pagado" : "pendiente",
            estadoNuevo: "cancelado",
            userId: staff.id,
            motivo: "Cancelado en test de integración",
          });

        await expect(cancelar()).resolves.toMatchObject({ ok: true });
        await expect(cancelar()).resolves.toEqual({ ok: false, motivo: "conflicto" });

        expect(await libroStock(tx, producto.id)).toEqual({ stock: 5, suma: 5 });
        const reposiciones = (await movimientos(tx, producto.id)).filter(
          (m) => m.reason === "cancelacion_pedido",
        );
        expect(reposiciones).toEqual([
          expect.objectContaining({ variation: 2, orderId, userId: staff.id }),
        ]);
      }
    }));

  it("rechaza transiciones inválidas sin escribir", () =>
    enTransaccion(async (tx) => {
      const admin = await import("@/server/data/admin-orders");
      const { orderId, staff } = await pedidoPendiente(tx);
      await tx.order.update({ where: { id: orderId }, data: { status: "caducado" } });

      for (const [estadoEsperado, estadoNuevo] of [
        ["caducado", "pagado"],
        ["caducado", "cancelado"],
        ["entregado", "pagado"],
        ["pendiente", "caducado"],
      ] as const) {
        await expect(
          admin.cambiarEstadoPedidoAdmin({
            orderId,
            estadoEsperado,
            estadoNuevo,
            userId: staff.id,
            motivo: "x",
          }),
        ).resolves.toEqual({ ok: false, motivo: "transicion-invalida" });
      }

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pedido.status).toBe("caducado");
      expect(pedido.paidAt).toBeNull();
    }));

  it("no cobra un pendiente vencido aunque la liberación aún no lo haya marcado", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const { orderId, staff } = await pedidoPendiente(tx);
      await vencer(tx, orderId);

      await expect(
        cobros.registrarCobroPedido({
          id: orderId,
          importe: 20,
          metodo: "efectivo",
          nota: null,
          staff: { id: staff.id, role: "encargado" },
        }),
      ).resolves.toEqual({ ok: false, motivo: "caducado" });

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(pedido.status).toBe("pendiente");
      expect(pedido.paidAt).toBeNull();
    }));
});

describe("caducidad de pedidos contra PostgreSQL", () => {
  it("un pedido vencido pasa a caducado y repone stock sin usuario; una segunda llamada no hace nada", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearUsuario(tx, "cliente");
      const producto = await crearProducto(tx, { stock: 4 });
      const resultado = await pedidos.crearPedidoCliente(
        cliente.id,
        [{ productId: producto.id, quantity: 3 }],
        "k1",
      );
      if (!resultado.ok) throw new Error("checkout fallido");
      await vencer(tx, resultado.pedidoId);

      await expect(pedidos.liberarPedidosCaducados()).resolves.toBe(1);
      await expect(pedidos.liberarPedidosCaducados()).resolves.toBe(0);

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: resultado.pedidoId } });
      expect(pedido.status).toBe("caducado");
      expect(await libroStock(tx, producto.id)).toEqual({ stock: 4, suma: 4 });
      expect(
        (await movimientos(tx, producto.id)).filter((m) => m.reason === "caducidad_pedido"),
      ).toEqual([
        { reason: "caducidad_pedido", variation: 3, orderId: resultado.pedidoId, userId: null },
      ]);
    }));

  it("no toca pedidos aún vigentes y caduca exactamente en expiresAt", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearUsuario(tx, "cliente");
      const producto = await crearProducto(tx, { stock: 2 });
      const resultado = await pedidos.crearPedidoCliente(
        cliente.id,
        [{ productId: producto.id, quantity: 1 }],
        "k1",
      );
      if (!resultado.ok) throw new Error("checkout fallido");
      const { expiresAt } = await tx.order.findUniqueOrThrow({ where: { id: resultado.pedidoId } });

      await expect(
        pedidos.liberarPedidosCaducados(new Date(expiresAt!.getTime() - 1)),
      ).resolves.toBe(0);
      await expect(pedidos.liberarPedidosCaducados(expiresAt!)).resolves.toBe(1);
    }));

  it("un producto archivado también recupera su stock", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearUsuario(tx, "cliente");
      const producto = await crearProducto(tx, { stock: 2 });
      const resultado = await pedidos.crearPedidoCliente(
        cliente.id,
        [{ productId: producto.id, quantity: 2 }],
        "k1",
      );
      if (!resultado.ok) throw new Error("checkout fallido");
      await tx.product.update({ where: { id: producto.id }, data: { active: false } });
      await vencer(tx, resultado.pedidoId);

      await pedidos.liberarPedidosCaducados();

      expect(await libroStock(tx, producto.id)).toEqual({ stock: 2, suma: 2 });
    }));

  it("el checkout libera el stock de un pedido vencido y lo usa", () =>
    enTransaccion(async (tx) => {
      const pedidos = await import("@/server/data/orders");
      const primero = await crearUsuario(tx, "cliente");
      const segundo = await crearUsuario(tx, "cliente");
      const producto = await crearProducto(tx, { stock: 1 });
      const retenido = await pedidos.crearPedidoCliente(
        primero.id,
        [{ productId: producto.id, quantity: 1 }],
        "k1",
      );
      if (!retenido.ok) throw new Error("checkout fallido");
      expect(await libroStock(tx, producto.id)).toEqual({ stock: 0, suma: 0 });

      await vencer(tx, retenido.pedidoId);
      const nuevo = await pedidos.crearPedidoCliente(
        segundo.id,
        [{ productId: producto.id, quantity: 1 }],
        "k2",
      );

      expect(nuevo.ok).toBe(true);
      const viejo = await tx.order.findUniqueOrThrow({ where: { id: retenido.pedidoId } });
      expect(viejo.status).toBe("caducado");
      expect(await libroStock(tx, producto.id)).toEqual({ stock: 0, suma: 0 });
    }));
});
