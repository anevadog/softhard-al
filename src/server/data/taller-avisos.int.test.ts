import { describe, expect, it } from "vitest";

import { crearSolicitud, crearUsuario, enTransaccion } from "@/test/integration/db";

const HORA = 3_600_000;

describe("notas, avisos y reportes contra PostgreSQL", () => {
  it("las faltas de repuesto se cuentan en el listado y se atienden una sola vez", () =>
    enTransaccion(async (tx) => {
      const notas = await import("@/server/data/request-notes");
      const admin = await import("@/server/data/admin-requests");
      const clienteDatos = await import("@/server/data/service-requests");
      const trabajador = await crearUsuario(tx, "trabajador");
      const staff = await crearUsuario(tx, "encargado");
      const cliente = await crearUsuario(tx, "cliente");
      const conFalta = await crearSolicitud(tx, {
        clientId: cliente.id,
        status: "en_reparacion",
        assigneeId: trabajador.id,
      });
      const sinFalta = await crearSolicitud(tx, { clientId: cliente.id, status: "en_reparacion" });

      await notas.crearNotaTrabajador({
        userId: trabajador.id,
        requestId: conFalta.id,
        tipo: "falta_repuesto",
        texto: "Falta la pantalla",
      });

      const listado = await admin.listarSolicitudesAdmin();
      expect(listado.find((f) => f.id === conFalta.id)?.faltasRepuestoPendientes).toBe(1);
      expect(listado.find((f) => f.id === sinFalta.id)?.faltasRepuestoPendientes).toBe(0);
      const filtrado = (await admin.listarSolicitudesAdmin(undefined, { soloFaltasRepuesto: true })).map(
        (f) => f.id,
      );
      expect(filtrado).toContain(conFalta.id);
      expect(filtrado).not.toContain(sinFalta.id);

      const [nota] = await notas.listarNotasReparacion(conFalta.id);
      await expect(
        notas.marcarNotaAtendida({ actorId: staff.id, noteId: nota!.id }),
      ).resolves.toEqual({ ok: true, requestId: conFalta.id });
      await expect(
        notas.marcarNotaAtendida({ actorId: staff.id, noteId: nota!.id }),
      ).resolves.toEqual({ ok: false, motivo: "ya-atendida" });

      const vistaCliente = await clienteDatos.obtenerSolicitudCliente(conFalta.id, cliente.id);
      expect(JSON.stringify(vistaCliente)).not.toContain("Falta la pantalla");
    }));

  it("el aviso de inactividad respeta el límite estricto y desaparece con actividad", () =>
    enTransaccion(async (tx) => {
      const avisos = await import("@/server/data/inactivity");
      const notas = await import("@/server/data/request-notes");
      const trabajador = await crearUsuario(tx, "trabajador");
      const cliente = await crearUsuario(tx, "cliente");
      const ahora = new Date();
      const limite = new Date(ahora.getTime() - 48 * HORA);
      const antigua = await crearSolicitud(tx, {
        clientId: cliente.id,
        status: "en_reparacion",
        assigneeId: trabajador.id,
        lastActivityAt: new Date(ahora.getTime() - 72 * HORA),
      });
      const justoEnElLimite = await crearSolicitud(tx, {
        clientId: cliente.id,
        status: "esperando_repuesto",
        assigneeId: trabajador.id,
        lastActivityAt: limite,
      });

      const antes = await avisos.listarMisReparacionesDescuidadas(trabajador.id, limite);
      expect(antes.elementos.map((r) => r.id)).toEqual([antigua.id]);
      expect(antes.elementos.map((r) => r.id)).not.toContain(justoEnElLimite.id);

      await notas.crearNotaTrabajador({
        userId: trabajador.id,
        requestId: antigua.id,
        tipo: "normal",
        texto: "Sigo con ella",
      });
      await expect(
        avisos.listarMisReparacionesDescuidadas(trabajador.id, limite),
      ).resolves.toMatchObject({ total: 0 });
    }));

  it("los reportes cuentan cada fichaje en su semana de inicio en Madrid, con cambio de hora", () =>
    enTransaccion(async (tx) => {
      const reportes = await import("@/server/data/reports");
      const { minutosPorReparacion, minutosPorTrabajador } = await import("@/lib/reports");
      const { semanaDesdeClave } = await import("@/lib/work-logs");
      const a = await crearUsuario(tx, "trabajador");
      const b = await crearUsuario(tx, "trabajador");
      const cliente = await crearUsuario(tx, "cliente");
      const r1 = await crearSolicitud(tx, { clientId: cliente.id, status: "en_reparacion", assigneeId: a.id });
      const fichaje = (userId: string, requestId: string | null, inicio: string, fin: string) =>
        tx.workLog.create({
          data: { userId, requestId, note: requestId ? null : "General", startedAt: new Date(inicio), endedAt: new Date(fin) },
        });

      // Sábado 24-10 22:00 → domingo 06:00 en Madrid: 9 h reales por el cambio de hora.
      await fichaje(a.id, r1.id, "2026-10-24T20:00:00Z", "2026-10-25T05:00:00Z");
      // Domingo 23:30 en Madrid: cuenta en la semana del 19 aunque acabe el lunes.
      await fichaje(a.id, r1.id, "2026-10-25T22:30:00Z", "2026-10-26T00:30:00Z");
      await fichaje(a.id, null, "2026-10-20T08:00:00Z", "2026-10-20T09:00:00Z");
      await fichaje(a.id, r1.id, "2026-10-12T08:00:00Z", "2026-10-12T11:00:00Z");
      // Lunes 00:30 en Madrid: ya es la semana del 26.
      await fichaje(b.id, null, "2026-10-25T23:30:00Z", "2026-10-26T01:30:00Z");

      const semana = semanaDesdeClave("2026-10-19", new Date());
      const ahora = new Date();
      const fichajes = (await reportes.listarFichajesSemana(semana)).filter((f) =>
        [a.id, b.id].includes(f.user.id),
      );
      const porTrabajador = minutosPorTrabajador(fichajes, [
        { id: a.id, name: a.name },
        { id: b.id, name: b.name },
      ], ahora);
      expect(porTrabajador.map((f) => [f.id, f.minutos])).toEqual([
        [a.id, 720],
        [b.id, 0],
      ]);

      const historicos = await reportes.listarFichajesDeReparaciones([r1.id]);
      const fila = minutosPorReparacion(fichajes, historicos, ahora).find((f) => f.request?.id === r1.id);
      expect(fila).toMatchObject({ minutosSemana: 660, minutosAcumulados: 840 });

      await expect(reportes.listarFichajesSemana(semana, b.id)).resolves.toHaveLength(0);
    }));
});
