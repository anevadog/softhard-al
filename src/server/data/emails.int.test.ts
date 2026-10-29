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
import { ConsoleEmailProvider, type EmailProvider } from "@/server/providers/email";

/** Outbox de emails (5.2): encolado en la transacción del evento y worker. */

const proveedorQueFalla = (mensaje = "SMTP caído"): EmailProvider => ({
  nombre: "falla",
  enviar: async () => {
    throw new Error(mensaje);
  },
});

async function emailsDe(tx: Tx, entityId: string) {
  return tx.pendingEmail.findMany({ where: { entityId }, orderBy: { createdAt: "asc" } });
}

async function checkout(tx: Tx) {
  const { crearPedidoCliente } = await import("@/server/data/orders");
  const cliente = await crearUsuario(tx, "cliente", "Cliente <Email>");
  const producto = await crearProducto(tx, { stock: 5, price: "29.95", name: "Teclado email" });
  const clave = `k-email-${producto.id}`;
  const resultado = await crearPedidoCliente(cliente.id, [{ productId: producto.id, quantity: 2 }], clave);
  if (!resultado.ok) throw new Error("checkout fallido");

  return { cliente, producto, clave, pedidoId: resultado.pedidoId };
}

/** Solicitud en `en_reparacion` con presupuesto aceptado, asignada a un trabajador. */
async function reparacionEnCurso(tx: Tx, modality: "taller" | "domicilio" = "taller") {
  const cliente = await crearUsuario(tx, "cliente");
  const trabajador = await crearUsuario(tx, "trabajador");
  const solicitud = await crearSolicitud(tx, {
    clientId: cliente.id,
    status: "en_reparacion",
    assigneeId: trabajador.id,
    modality,
    address: modality === "domicilio" ? "Calle Falsa 1, Madrid" : null,
  });
  await crearPresupuesto(tx, { requestId: solicitud.id, status: "aceptado" });

  return { cliente, trabajador, solicitud };
}

describe("encolado en la transacción del evento", () => {
  it("el checkout encola un único 'pedido confirmado' y repetirlo no duplica", () =>
    enTransaccion(async (tx) => {
      const { crearPedidoCliente } = await import("@/server/data/orders");
      const { cliente, producto, clave, pedidoId } = await checkout(tx);

      // Misma clave de idempotencia: mismo pedido, ningún email más.
      await crearPedidoCliente(cliente.id, [{ productId: producto.id, quantity: 2 }], clave);

      const emails = await emailsDe(tx, pedidoId);
      expect(emails).toHaveLength(1);
      expect(emails[0]).toMatchObject({ event: "pedido_confirmado", status: "pendiente", to: cliente.email });
      expect(emails[0]?.text).toContain("2 × Teclado email");
      expect(emails[0]?.text).toContain("59,90");
      expect(emails[0]?.text).toContain(`/app/pedidos/${pedidoId}`);
      expect(emails[0]?.html).toContain("Cliente &lt;Email&gt;");
    }));

  it("crear el presupuesto encola 'presupuesto listo'", () =>
    enTransaccion(async (tx) => {
      const { crearPresupuesto: crearPresupuestoData } = await import("@/server/data/admin-requests");
      const staff = await crearUsuario(tx, "encargado");
      const cliente = await crearUsuario(tx, "cliente");
      const solicitud = await crearSolicitud(tx, { clientId: cliente.id, status: "pendiente" });

      const resultado = await crearPresupuestoData({
        requestId: solicitud.id,
        budgetAmount: 120,
        diagnosticFee: 30,
        finalAmount: 90,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userId: staff.id,
      });
      expect(resultado.ok).toBe(true);

      const emails = await emailsDe(tx, solicitud.id);
      expect(emails.map((email) => email.event)).toEqual(["presupuesto_listo"]);
      expect(emails[0]?.text).toContain("pagarás 90,00");
    }));

  it("pasar a 'lista' encola 'reparación lista' una sola vez, aunque se repita la transición", () =>
    enTransaccion(async (tx) => {
      const { cambiarEstadoSolicitud } = await import("@/server/data/service-status");
      const { trabajador, solicitud } = await reparacionEnCurso(tx, "domicilio");
      const encargado = await crearUsuario(tx, "encargado");

      expect(
        await cambiarEstadoSolicitud({
          requestId: solicitud.id,
          estadoEsperado: "en_reparacion",
          estadoNuevo: "lista",
          actorId: trabajador.id,
          rol: "trabajador",
        }),
      ).toEqual({ ok: true });

      // Corrección hacia atrás y vuelta a `lista`: el único evita otro email.
      await cambiarEstadoSolicitud({
        requestId: solicitud.id,
        estadoEsperado: "lista",
        estadoNuevo: "en_reparacion",
        actorId: encargado.id,
        rol: "encargado",
        motivo: "Falta revisar el ventilador",
      });
      await cambiarEstadoSolicitud({
        requestId: solicitud.id,
        estadoEsperado: "en_reparacion",
        estadoNuevo: "lista",
        actorId: encargado.id,
        rol: "encargado",
      });

      const emails = await emailsDe(tx, solicitud.id);
      expect(emails.map((email) => email.event)).toEqual(["reparacion_lista"]);
      expect(emails[0]?.text).toContain("Te lo llevaremos");
      expect(emails[0]?.text).toContain("Importe pendiente");
    }));

  it("otros cambios de estado no encolan nada", () =>
    enTransaccion(async (tx) => {
      const { cambiarEstadoSolicitud } = await import("@/server/data/service-status");
      const { trabajador, solicitud } = await reparacionEnCurso(tx);

      await cambiarEstadoSolicitud({
        requestId: solicitud.id,
        estadoEsperado: "en_reparacion",
        estadoNuevo: "esperando_repuesto",
        actorId: trabajador.id,
        rol: "trabajador",
      });

      expect(await emailsDe(tx, solicitud.id)).toEqual([]);
    }));

  it("si la transacción del evento se revierte, no queda fila encolada", () =>
    enTransaccion(async (tx) => {
      const { encolarReparacionListaEnTx } = await import("@/server/data/emails");
      const { solicitud } = await reparacionEnCurso(tx);

      await conSavepoint(tx, async () => {
        expect(await encolarReparacionListaEnTx(tx, solicitud.id)).toBe(true);
        expect(await emailsDe(tx, solicitud.id)).toHaveLength(1);
      });

      expect(await emailsDe(tx, solicitud.id)).toEqual([]);
    }));
});

describe("worker", () => {
  it("envía por el proveedor y marca 'enviado'; la segunda pasada no reenvía", () =>
    enTransaccion(async (tx) => {
      const { procesarEmailsPendientes } = await import("@/server/data/emails");
      const { pedidoId, cliente } = await checkout(tx);
      const provider = new ConsoleEmailProvider();

      expect(await procesarEmailsPendientes({ provider })).toMatchObject({ enviados: 1 });
      expect(await procesarEmailsPendientes({ provider })).toMatchObject({ enviados: 0 });

      expect(provider.enviados).toHaveLength(1);
      expect(provider.enviados[0]?.to).toBe(cliente.email);
      const [email] = await emailsDe(tx, pedidoId);
      expect(email).toMatchObject({ status: "enviado", attempts: 0, lockedAt: null });
      expect(email?.sentAt).not.toBeNull();
    }));

  it("un fallo del proveedor no afecta al pedido: reintenta y, a los 5 intentos, 'fallido'", () =>
    enTransaccion(async (tx) => {
      const { procesarEmailsPendientes, reintentarEmailFallido } = await import("@/server/data/emails");
      const { pedidoId } = await checkout(tx);

      expect(await tx.order.findUnique({ where: { id: pedidoId } })).not.toBeNull();

      await procesarEmailsPendientes({ provider: proveedorQueFalla() });
      let [email] = await emailsDe(tx, pedidoId);
      expect(email).toMatchObject({ status: "pendiente", attempts: 1, lastError: "SMTP caído" });

      for (let i = 0; i < 4; i++) {
        await procesarEmailsPendientes({ provider: proveedorQueFalla() });
      }
      [email] = await emailsDe(tx, pedidoId);
      expect(email).toMatchObject({ status: "fallido", attempts: 5 });

      // Un fallido ya no se reclama…
      expect(await procesarEmailsPendientes({ provider: new ConsoleEmailProvider() })).toMatchObject({
        enviados: 0,
      });

      // …hasta que el staff lo reintenta: vuelve a pendiente con los intentos a 0.
      expect(await reintentarEmailFallido(email!.id)).toBe(true);
      expect(await reintentarEmailFallido(email!.id)).toBe(false);
      expect(await procesarEmailsPendientes({ provider: new ConsoleEmailProvider() })).toMatchObject({
        enviados: 1,
      });
    }));

  it("reclama una fila 'enviando' abandonada hace más de 5 minutos, no una reciente", () =>
    enTransaccion(async (tx) => {
      const { procesarEmailsPendientes } = await import("@/server/data/emails");
      const { pedidoId } = await checkout(tx);
      const ahora = new Date();
      const [email] = await emailsDe(tx, pedidoId);

      await tx.pendingEmail.update({
        where: { id: email!.id },
        data: { status: "enviando", lockedAt: new Date(ahora.getTime() - 60_000) },
      });
      expect(await procesarEmailsPendientes({ provider: new ConsoleEmailProvider(), ahora })).toMatchObject({
        enviados: 0,
      });

      await tx.pendingEmail.update({
        where: { id: email!.id },
        data: { lockedAt: new Date(ahora.getTime() - 6 * 60_000) },
      });
      expect(await procesarEmailsPendientes({ provider: new ConsoleEmailProvider(), ahora })).toMatchObject({
        enviados: 1,
      });
    }));
});
