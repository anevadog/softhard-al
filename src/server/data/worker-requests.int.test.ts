import { describe, expect, it } from "vitest";

import { crearSolicitud, crearUsuario, enTransaccion } from "@/test/integration/db";

describe("taller: visibilidad y toma contra PostgreSQL", () => {
  it("cada trabajador ve solo lo suyo y las aceptadas libres nunca devueltas", () =>
    enTransaccion(async (tx) => {
      const taller = await import("@/server/data/worker-requests");
      const a = await crearUsuario(tx, "trabajador");
      const b = await crearUsuario(tx, "trabajador");
      const cliente = await crearUsuario(tx, "cliente", "Cliente Integración");
      const propia = await crearSolicitud(tx, {
        clientId: cliente.id,
        status: "en_reparacion",
        assigneeId: a.id,
        modality: "domicilio",
        address: "Calle de Prueba 1",
      });
      const deB = await crearSolicitud(tx, { clientId: cliente.id, status: "en_reparacion", assigneeId: b.id });
      const libre = await crearSolicitud(tx, { clientId: cliente.id, status: "aceptada" });
      const entregada = await crearSolicitud(tx, { clientId: cliente.id, status: "entregada", assigneeId: a.id });

      const mias = (await taller.listarMisReparaciones(a.id)).map((r) => r.id);
      expect(mias).toEqual([propia.id]);
      expect(mias).not.toContain(entregada.id);

      const detalle = await taller.obtenerReparacionTrabajador(propia.id, a.id);
      expect(detalle?.esMia).toBe(true);
      if (detalle?.esMia) {
        expect(detalle.clientName).toBe("Cliente Integración");
        expect(detalle.address).toBe("Calle de Prueba 1");
      }
      expect(JSON.stringify(detalle)).not.toContain("600000000");

      await expect(taller.obtenerReparacionTrabajador(deB.id, a.id)).resolves.toBeNull();

      const vistaLibre = await taller.obtenerReparacionTrabajador(libre.id, a.id);
      expect(vistaLibre?.esMia).toBe(false);
      expect(vistaLibre).not.toHaveProperty("statusHistory");
      expect(vistaLibre).not.toHaveProperty("address");
      expect(JSON.stringify(vistaLibre)).not.toContain("Cliente Integración");
    }));

  it("una devuelta no sale en Para tomar ni se puede tomar (filtro de relación en updateMany)", () =>
    enTransaccion(async (tx) => {
      const taller = await import("@/server/data/worker-requests");
      const asign = await import("@/server/data/assignments");
      const a = await crearUsuario(tx, "trabajador");
      const b = await crearUsuario(tx, "trabajador");
      const cliente = await crearUsuario(tx, "cliente");
      const devuelta = await crearSolicitud(tx, { clientId: cliente.id, status: "aceptada", assigneeId: a.id });
      const libre = await crearSolicitud(tx, { clientId: cliente.id, status: "aceptada" });

      await expect(
        asign.devolverSolicitudTrabajador({
          requestId: devuelta.id,
          actorId: a.id,
          actorRol: "trabajador",
          motivo: "Sin herramienta",
        }),
      ).resolves.toEqual({ ok: true });

      const paraTomar = (await taller.listarReparacionesParaTomar()).map((r) => r.id);
      expect(paraTomar).toContain(libre.id);
      expect(paraTomar).not.toContain(devuelta.id);

      await expect(
        asign.tomarSolicitudTrabajador({ requestId: devuelta.id, actorId: b.id, actorRol: "trabajador" }),
      ).resolves.toEqual({ ok: false, motivo: "no-disponible" });
      await expect(taller.obtenerReparacionTrabajador(devuelta.id, b.id)).resolves.toBeNull();
      await expect(
        asign.tomarSolicitudTrabajador({ requestId: libre.id, actorId: b.id, actorRol: "trabajador" }),
      ).resolves.toEqual({ ok: true });
      await expect(
        asign.tomarSolicitudTrabajador({ requestId: libre.id, actorId: a.id, actorRol: "trabajador" }),
      ).resolves.toEqual({ ok: false, motivo: "no-disponible" });
    }));
});
