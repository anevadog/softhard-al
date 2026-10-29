import { describe, expect, it } from "vitest";

import { sinRollback } from "@/test/integration/sin-rollback";

/** Concurrencia real del cobro: cada operación en su propia conexión. */
describe("cobros con concurrencia real", () => {
  async function reparacionLista(
    db: Parameters<Parameters<typeof sinRollback>[0]>[0]["db"],
    clientId: string,
  ) {
    const solicitud = await db.serviceRequest.create({
      data: {
        clientId,
        status: "lista",
        equipmentType: "portatil",
        brand: "Test",
        model: "Concurrencia",
        issue: "Avería de prueba de concurrencia",
        modality: "taller",
      },
      select: { id: true },
    });
    await db.quote.create({
      data: {
        requestId: solicitud.id,
        budgetAmount: "120.00",
        diagnosticFee: "30.00",
        finalAmount: "90.00",
        status: "aceptado",
        expiresAt: new Date(Date.now() + 86_400_000),
        decidedAt: new Date(),
      },
    });

    return solicitud.id;
  }

  it("dos registros simultáneos del mismo cobro: solo uno se guarda", () =>
    sinRollback(async ({ db, crearCliente, crearUsuario }) => {
      const cobros = await import("@/server/data/payments");
      const cliente = await crearCliente();
      const [a, b] = await Promise.all([crearUsuario("encargado"), crearUsuario("encargado")]);
      const requestId = await reparacionLista(db, cliente.id);
      const datos = { id: requestId, importe: 90, metodo: "efectivo" as const, nota: null };

      const resultados = await Promise.all([
        cobros.registrarCobroSolicitud({ ...datos, staff: { id: a.id, role: "encargado" } }),
        cobros.registrarCobroSolicitud({ ...datos, staff: { id: b.id, role: "encargado" } }),
      ]);

      expect(resultados.filter((r) => r.ok)).toHaveLength(1);
      expect(resultados.filter((r) => !r.ok)).toEqual([{ ok: false, motivo: "ya-cobrado" }]);
    }));

  it("cobro y entrega a la vez: nunca queda entregada sin cobro", () =>
    sinRollback(async ({ db, crearCliente, crearUsuario }) => {
      const cobros = await import("@/server/data/payments");
      const estados = await import("@/server/data/service-status");
      const cliente = await crearCliente();
      const encargado = await crearUsuario("encargado");
      const requestId = await reparacionLista(db, cliente.id);

      const [cobro, entrega] = await Promise.all([
        cobros.registrarCobroSolicitud({
          id: requestId,
          importe: 90,
          metodo: "bizum",
          nota: null,
          staff: { id: encargado.id, role: "encargado" },
        }),
        estados.cambiarEstadoSolicitud({
          requestId,
          estadoEsperado: "lista",
          estadoNuevo: "entregada",
          actorId: encargado.id,
          rol: "encargado",
        }),
      ]);

      const solicitud = await db.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
      expect(cobro).toEqual({ ok: true });
      expect(solicitud.paidAt).not.toBeNull();

      if (entrega.ok) {
        expect(solicitud.status).toBe("entregada");
      } else {
        expect(entrega).toEqual({ ok: false, motivo: "requiere-pago" });
        expect(solicitud.status).toBe("lista");
      }
    }));
});
