import { describe, expect, it } from "vitest";

import { crearUsuario, enTransaccion } from "@/test/integration/db";

describe("límite de login y solicitudes contra PostgreSQL", () => {
  it("bloquea al quinto fallo por email y a los 20 por IP, y limpia lo de más de 24 h", () =>
    enTransaccion(async (tx) => {
      const intentos = await import("@/server/data/login-attempts");
      const { evaluarLimite } = await import("@/lib/login-rate-limit");
      const ahora = new Date();
      const email = "int-login@test.local";
      const ip = "203.0.113.200";

      for (let i = 0; i < 4; i++) {
        await intentos.registrarIntentoLogin({ email, ip, success: false }, ahora);
      }
      expect(evaluarLimite(await intentos.contarFallosRecientes(email, ip, ahora)).bloqueado).toBe(false);

      await intentos.registrarIntentoLogin({ email, ip, success: false }, ahora);
      expect(evaluarLimite(await intentos.contarFallosRecientes(email, ip, ahora))).toEqual({
        bloqueado: true,
        motivo: "email",
      });

      for (let i = 0; i < 15; i++) {
        await intentos.registrarIntentoLogin({ email: `${i}-${email}`, ip, success: false }, ahora);
      }
      expect(
        evaluarLimite(await intentos.contarFallosRecientes("nuevo@test.local", ip, ahora)),
      ).toEqual({ bloqueado: true, motivo: "ip" });

      const despues = new Date(ahora.getTime() + 16 * 60_000);
      expect(evaluarLimite(await intentos.contarFallosRecientes(email, ip, despues)).bloqueado).toBe(false);

      await tx.loginAttempt.create({
        data: { email: "viejo@test.local", success: false, createdAt: new Date(ahora.getTime() - 25 * 3_600_000) },
      });
      await intentos.registrarIntentoLogin({ email, ip: null, success: true }, ahora);
      await expect(tx.loginAttempt.count({ where: { email: "viejo@test.local" } })).resolves.toBe(0);
    }));

  it("guarda la dirección a domicilio y el cliente no recibe datos internos del taller", () =>
    enTransaccion(async (tx) => {
      const solicitudes = await import("@/server/data/service-requests");
      const { serviceRequestSchema } = await import("@/lib/validations/service-request");
      const cliente = await crearUsuario(tx, "cliente");

      const entrada = serviceRequestSchema.parse({
        equipmentType: "portatil",
        brand: "HP",
        model: "440",
        issue: "La pantalla parpadea al arrancar.",
        modality: "domicilio",
        timeSlot: "tarde",
        address: "  Calle Mayor 1, Madrid  ",
      });
      const { id } = await solicitudes.crearSolicitudCliente(cliente.id, entrada);

      const detalle = await solicitudes.obtenerSolicitudCliente(id, cliente.id);
      expect(detalle?.address).toBe("Calle Mayor 1, Madrid");
      expect(detalle).not.toHaveProperty("notes");
      expect(detalle).not.toHaveProperty("workLogs");

      const otro = await crearUsuario(tx, "cliente");
      await expect(solicitudes.obtenerSolicitudCliente(id, otro.id)).resolves.toBeNull();
    }));
});
