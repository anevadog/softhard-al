import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    loginAttempt: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { contarFallosRecientes, registrarIntentoLogin } from "@/server/data/login-attempts";

const ahora = new Date("2026-10-28T12:00:00Z");

describe("intentos de login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.loginAttempt.count).mockResolvedValue(3);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  });

  it("cuenta solo fallos de los últimos 15 minutos por email y por IP", async () => {
    await expect(
      contarFallosRecientes("cliente@demo.local", "203.0.113.7", ahora),
    ).resolves.toEqual({ porEmail: 3, porIp: 3 });

    const desde = new Date("2026-10-28T11:45:00Z");
    expect(prisma.loginAttempt.count).toHaveBeenCalledWith({
      where: { email: "cliente@demo.local", success: false, createdAt: { gte: desde } },
    });
    expect(prisma.loginAttempt.count).toHaveBeenCalledWith({
      where: { ip: "203.0.113.7", success: false, createdAt: { gte: desde } },
    });
  });

  it("sin IP no consulta por IP", async () => {
    await expect(contarFallosRecientes("cliente@demo.local", null, ahora)).resolves.toEqual({
      porEmail: 3,
      porIp: null,
    });
    expect(prisma.loginAttempt.count).toHaveBeenCalledTimes(1);
  });

  it("registra el intento y borra en la misma transacción los de más de 24 h", async () => {
    await registrarIntentoLogin({ email: "cliente@demo.local", ip: null, success: false }, ahora);

    expect(prisma.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2026-10-27T12:00:00Z") } },
    });
    expect(prisma.loginAttempt.create).toHaveBeenCalledWith({
      data: { email: "cliente@demo.local", ip: null, success: false, createdAt: ahora },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
