import { describe, expect, it } from "vitest";

import { conSavepoint, crearSolicitud, crearUsuario, enTransaccion } from "@/test/integration/db";

describe("fichaje contra PostgreSQL", () => {
  it("entrada y salida en una reparación propia actualizan la actividad", () =>
    enTransaccion(async (tx) => {
      const datos = await import("@/server/data/work-logs");
      const trabajador = await crearUsuario(tx, "trabajador");
      const cliente = await crearUsuario(tx, "cliente");
      const antigua = new Date(Date.now() - 72 * 3_600_000);
      const reparacion = await crearSolicitud(tx, {
        clientId: cliente.id,
        status: "en_reparacion",
        assigneeId: trabajador.id,
        lastActivityAt: antigua,
      });

      const entrada = await datos.ficharEntradaReparacion({
        userId: trabajador.id,
        requestId: reparacion.id,
      });
      expect(entrada).toEqual({ ok: true, requestId: reparacion.id });

      const abierto = await datos.obtenerFichajeAbierto(trabajador.id);
      expect(abierto?.request?.id).toBe(reparacion.id);
      expect(
        (await tx.serviceRequest.findUniqueOrThrow({ where: { id: reparacion.id } })).lastActivityAt
          > antigua,
      ).toBe(true);

      await expect(
        datos.ficharSalida({ userId: trabajador.id, workLogId: abierto!.id }),
      ).resolves.toEqual({ ok: true, requestId: reparacion.id });
      await expect(
        datos.ficharSalida({ userId: trabajador.id, workLogId: abierto!.id }),
      ).resolves.toEqual({ ok: false, motivo: "no-abierto" });
    }));

  it("no ficha en una reparación ajena ni fuera de en_reparacion", () =>
    enTransaccion(async (tx) => {
      const datos = await import("@/server/data/work-logs");
      const a = await crearUsuario(tx, "trabajador");
      const b = await crearUsuario(tx, "trabajador");
      const cliente = await crearUsuario(tx, "cliente");
      const deB = await crearSolicitud(tx, { clientId: cliente.id, status: "en_reparacion", assigneeId: b.id });
      const aceptada = await crearSolicitud(tx, { clientId: cliente.id, status: "aceptada", assigneeId: a.id });

      for (const requestId of [deB.id, aceptada.id]) {
        await expect(
          datos.ficharEntradaReparacion({ userId: a.id, requestId }),
        ).resolves.toEqual({ ok: false, motivo: "reparacion-no-disponible" });
      }
    }));

  it("el índice único parcial impide un segundo fichaje abierto (P2002 → ya-abierto)", () =>
    enTransaccion(async (tx) => {
      const datos = await import("@/server/data/work-logs");
      const trabajador = await crearUsuario(tx, "trabajador");

      await expect(
        datos.ficharEntradaGeneral({ userId: trabajador.id, nota: "Inventario" }),
      ).resolves.toEqual({ ok: true, requestId: null });

      // Sin la comprobación previa de la capa de datos: lo rechaza la base.
      const duplicado = await conSavepoint(tx, () =>
        datos.ficharEntradaGeneral({ userId: trabajador.id, nota: "Otra vez" }),
      );
      expect(duplicado).toEqual({ ok: false, motivo: "ya-abierto" });
    }));

  it("el check rechaza una salida anterior a la entrada", () =>
    enTransaccion(async (tx) => {
      const trabajador = await crearUsuario(tx, "trabajador");
      const fichaje = await tx.workLog.create({
        data: { userId: trabajador.id, note: "x", startedAt: new Date() },
      });

      await expect(
        conSavepoint(tx, () =>
          tx.workLog.update({
            where: { id: fichaje.id },
            data: { endedAt: new Date(fichaje.startedAt.getTime() - 3_600_000) },
          }),
        ),
      ).rejects.toThrow();
    }));

  it("marcar la reparación como lista cierra el fichaje abierto", () =>
    enTransaccion(async (tx) => {
      const datos = await import("@/server/data/work-logs");
      const estado = await import("@/server/data/service-status");
      const trabajador = await crearUsuario(tx, "trabajador");
      const cliente = await crearUsuario(tx, "cliente");
      const reparacion = await crearSolicitud(tx, {
        clientId: cliente.id,
        status: "en_reparacion",
        assigneeId: trabajador.id,
      });

      await datos.ficharEntradaReparacion({ userId: trabajador.id, requestId: reparacion.id });
      await expect(
        estado.cambiarEstadoSolicitud({
          requestId: reparacion.id,
          estadoEsperado: "en_reparacion",
          estadoNuevo: "lista",
          actorId: trabajador.id,
          rol: "trabajador",
        }),
      ).resolves.toEqual({ ok: true });
      await expect(datos.obtenerFichajeAbierto(trabajador.id)).resolves.toBeNull();
    }));

  it("el staff cierra y corrige con constancia del editor, sin reabrir", () =>
    enTransaccion(async (tx) => {
      const datos = await import("@/server/data/work-logs");
      const trabajador = await crearUsuario(tx, "trabajador");
      const staff = await crearUsuario(tx, "encargado");
      await datos.ficharEntradaGeneral({ userId: trabajador.id, nota: "Limpieza" });
      const abierto = await datos.obtenerFichajeAbierto(trabajador.id);

      await expect(
        datos.cerrarFichajeStaff({ actorId: staff.id, workLogId: abierto!.id }),
      ).resolves.toEqual({ ok: true, requestId: null });

      const inicio = new Date(Date.now() - 3 * 3_600_000);
      const fin = new Date(Date.now() - 3_600_000);
      await datos.corregirFichajeStaff({
        actorId: staff.id,
        workLogId: abierto!.id,
        inicio,
        fin,
        nota: "Corregido",
      });

      const corregido = await tx.workLog.findUniqueOrThrow({ where: { id: abierto!.id } });
      expect(corregido.startedAt).toEqual(inicio);
      expect(corregido.endedAt).toEqual(fin);
      expect(corregido.editedById).toBe(staff.id);
      await expect(
        datos.corregirFichajeStaff({
          actorId: staff.id,
          workLogId: abierto!.id,
          inicio,
          fin: null,
          nota: "x",
        }),
      ).resolves.toEqual({ ok: false, motivo: "no-reabrir" });
    }));
});
