import { describe, expect, it } from "vitest";

import { sinRollback } from "@/test/integration/sin-rollback";

/**
 * Concurrencia real: cada operación usa su propia conexión y transacción. Los
 * datos llevan el prefijo de la ejecución y se borran al terminar (sin rollback).
 */
describe("pedidos con concurrencia real", () => {
  it("dos checkouts simultáneos por la última unidad: gana uno y el stock no baja de 0", () =>
    sinRollback(async ({ db, crearCliente, crearProducto }) => {
      const pedidos = await import("@/server/data/orders");
      const [a, b] = await Promise.all([crearCliente(), crearCliente()]);
      const producto = await crearProducto(1);
      const items = [{ productId: producto.id, quantity: 1 }];

      const resultados = await Promise.all([
        pedidos.crearPedidoCliente(a.id, items, "clave-a"),
        pedidos.crearPedidoCliente(b.id, items, "clave-b"),
      ]);

      expect(resultados.filter((r) => r.ok)).toHaveLength(1);
      expect(resultados.filter((r) => !r.ok)).toEqual([
        { ok: false, motivo: "stock-insuficiente", productIds: [producto.id] },
      ]);

      const { stock } = await db.product.findUniqueOrThrow({ where: { id: producto.id } });
      expect(stock).toBe(0);
      expect(
        await db.stockMovement.count({ where: { productId: producto.id, reason: "venta" } }),
      ).toBe(1);
    }));

  it("caducidad y cancelación del mismo pedido a la vez reponen el stock una sola vez", () =>
    sinRollback(async ({ db, crearCliente, crearProducto }) => {
      const pedidos = await import("@/server/data/orders");
      const admin = await import("@/server/data/admin-orders");
      const cliente = await crearCliente();
      const producto = await crearProducto(3);
      const resultado = await pedidos.crearPedidoCliente(
        cliente.id,
        [{ productId: producto.id, quantity: 2 }],
        "clave",
      );
      if (!resultado.ok) throw new Error("checkout fallido");
      await db.order.update({
        where: { id: resultado.pedidoId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      await Promise.all([
        pedidos.liberarPedidosCaducados(),
        admin.cambiarEstadoPedidoAdmin({
          orderId: resultado.pedidoId,
          estadoEsperado: "pendiente",
          estadoNuevo: "cancelado",
          userId: cliente.id,
          motivo: "Carrera de prueba",
        }),
      ]);

      const pedido = await db.order.findUniqueOrThrow({ where: { id: resultado.pedidoId } });
      expect(["caducado", "cancelado"]).toContain(pedido.status);
      const reposiciones = await db.stockMovement.findMany({
        where: { productId: producto.id, variation: { gt: 0 }, reason: { not: "stock_inicial" } },
      });
      expect(reposiciones).toHaveLength(1);
      const { stock } = await db.product.findUniqueOrThrow({ where: { id: producto.id } });
      expect(stock).toBe(3);
    }));

  it("dos liberaciones simultáneas caducan el pedido una sola vez", () =>
    sinRollback(async ({ db, crearCliente, crearProducto }) => {
      const pedidos = await import("@/server/data/orders");
      const cliente = await crearCliente();
      const producto = await crearProducto(2);
      const resultado = await pedidos.crearPedidoCliente(
        cliente.id,
        [{ productId: producto.id, quantity: 2 }],
        "clave",
      );
      if (!resultado.ok) throw new Error("checkout fallido");
      await db.order.update({
        where: { id: resultado.pedidoId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const caducados = await Promise.all([
        pedidos.liberarPedidosCaducados(),
        pedidos.liberarPedidosCaducados(),
      ]);

      expect(caducados[0] + caducados[1]).toBe(1);
      expect(
        await db.stockMovement.count({
          where: { productId: producto.id, reason: "caducidad_pedido" },
        }),
      ).toBe(1);
      const { stock } = await db.product.findUniqueOrThrow({ where: { id: producto.id } });
      expect(stock).toBe(2);
    }));
});
