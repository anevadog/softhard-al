import { describe, expect, it } from "vitest";

import { MockPaymentProvider } from "@/server/providers/payments";
import { sinRollback } from "@/test/integration/sin-rollback";

/**
 * Carrera real entre la pasarela y el registro manual del staff sobre el mismo
 * pedido (5.3): gana uno, hay un solo cobro y una sola factura, y si gana el
 * manual la sesión de la pasarela se reembolsa.
 */

describe("pasarela y cobro manual en carrera", () => {
  it("solo uno cobra; la sesión sobrante se reembolsa", () =>
    sinRollback(async ({ db, crearCliente, crearUsuario, crearProducto }) => {
      const { crearPedidoCliente } = await import("@/server/data/orders");
      const { iniciarPago, confirmarPago } = await import("@/server/data/online-payments");
      const { registrarCobroPedido } = await import("@/server/data/payments");
      const provider = new MockPaymentProvider();

      const cliente = await crearCliente();
      const encargado = await crearUsuario("encargado");
      const producto = await crearProducto(3);
      const pedido = await crearPedidoCliente(cliente.id, [{ productId: producto.id, quantity: 1 }], `k-carrera-${producto.id}`);
      if (!pedido.ok) throw new Error("checkout fallido");

      const inicio = await iniciarPago({ entidad: { tipo: "pedido", id: pedido.pedidoId }, clienteId: cliente.id, provider });
      if (!inicio.ok) throw new Error("no se pudo iniciar el pago");
      const sesion = await db.paymentSession.findFirstOrThrow({ where: { orderId: pedido.pedidoId } });

      const [pasarela, manual] = await Promise.all([
        confirmarPago({ referencia: sesion.providerRef, resultado: "pagado" }, provider),
        registrarCobroPedido({
          id: pedido.pedidoId,
          importe: 10,
          metodo: "bizum",
          nota: null,
          staff: { id: encargado.id, role: "encargado" },
        }),
      ]);

      const ganaPasarela = pasarela?.estado === "completada";
      expect(ganaPasarela).toBe(!manual.ok);
      expect(pasarela?.estado).toBe(ganaPasarela ? "completada" : "reembolsada");
      expect(provider.reembolsos).toEqual(ganaPasarela ? [] : [sesion.providerRef]);

      const final = await db.order.findUniqueOrThrow({ where: { id: pedido.pedidoId } });
      expect(final.status).toBe("pagado");
      expect(final.paymentMethod).toBe(ganaPasarela ? "tarjeta_online" : "bizum");
      expect(await db.invoice.count({ where: { orderId: pedido.pedidoId } })).toBe(1);
    }));
});
