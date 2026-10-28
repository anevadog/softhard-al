import { beforeEach, describe, expect, it, vi } from "vitest";

// next-auth real no carga en Vitest (depende de next/server): basta su clase de error.
vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/server/data/login-attempts", () => ({
  contarFallosRecientes: vi.fn(),
  registrarIntentoLogin: vi.fn(),
}));

import { autorizarCredenciales, DemasiadosIntentos } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { contarFallosRecientes, registrarIntentoLogin } from "@/server/data/login-attempts";

const USUARIO = {
  id: "u-1",
  email: "cliente@demo.local",
  name: "Cliente Demo",
  role: "cliente",
  passwordHash: "hash-real",
};
const CREDENCIALES = { email: "  Cliente@Demo.local ", password: "Demo1234!" };
const peticion = (ip?: string) => ({
  headers: new Headers(ip ? { "x-forwarded-for": ip } : {}),
});

describe("autorizarCredenciales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(contarFallosRecientes).mockResolvedValue({ porEmail: 0, porIp: 0 });
    vi.mocked(registrarIntentoLogin).mockResolvedValue(undefined);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(USUARIO as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
  });

  it("autentica, normaliza el email y registra el éxito con la IP", async () => {
    await expect(
      autorizarCredenciales(CREDENCIALES, peticion("203.0.113.7")),
    ).resolves.toEqual({
      id: "u-1",
      email: "cliente@demo.local",
      name: "Cliente Demo",
      role: "cliente",
    });

    expect(contarFallosRecientes).toHaveBeenCalledWith("cliente@demo.local", "203.0.113.7");
    expect(registrarIntentoLogin).toHaveBeenCalledWith({
      email: "cliente@demo.local",
      ip: "203.0.113.7",
      success: true,
    });
  });

  it("registra el fallo con contraseña incorrecta", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(autorizarCredenciales(CREDENCIALES, peticion())).resolves.toBeNull();
    expect(registrarIntentoLogin).toHaveBeenCalledWith({
      email: "cliente@demo.local",
      ip: null,
      success: false,
    });
  });

  it("con un email inexistente compara contra el hash de relleno y registra el fallo", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await expect(autorizarCredenciales(CREDENCIALES, peticion())).resolves.toBeNull();
    expect(verifyPassword).toHaveBeenCalledWith("Demo1234!", expect.stringMatching(/^\$2b\$12\$/));
    expect(registrarIntentoLogin).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  it("bloquea con el límite superado aunque la contraseña sea correcta", async () => {
    vi.mocked(contarFallosRecientes).mockResolvedValue({ porEmail: 5, porIp: 0 });

    await expect(autorizarCredenciales(CREDENCIALES, peticion())).rejects.toBeInstanceOf(
      DemasiadosIntentos,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(registrarIntentoLogin).not.toHaveBeenCalled();
  });

  it("el bloqueo es igual para un email que no existe (no revela cuentas)", async () => {
    vi.mocked(contarFallosRecientes).mockResolvedValue({ porEmail: 0, porIp: 20 });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const error = await autorizarCredenciales(
      { email: "nadie@demo.local", password: "x".repeat(8) },
      peticion("198.51.100.2"),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DemasiadosIntentos);
    expect((error as DemasiadosIntentos).code).toBe("rate_limited");
  });

  it("rechaza credenciales mal formadas sin consultar ni registrar nada", async () => {
    await expect(autorizarCredenciales({ email: "no-es-email", password: "" })).resolves.toBeNull();
    expect(contarFallosRecientes).not.toHaveBeenCalled();
    expect(registrarIntentoLogin).not.toHaveBeenCalled();
  });
});
