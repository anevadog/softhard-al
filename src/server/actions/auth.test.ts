import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { loginUser, registerUser } from "@/server/actions/auth";
import { AUTH_FORM_STATE_INICIAL } from "@/server/actions/auth-state";
import { redirect } from "next/navigation";

const CREDENCIALES = {
  email: "cliente@demo.local",
  password: "Demo1234!",
};

function formulario(valores: Record<string, string>) {
  const data = new FormData();

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

describe("callback tras autenticarse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signIn).mockResolvedValue(undefined);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "cliente",
    } as never);
    vi.mocked(prisma.user.create).mockResolvedValue({} as never);
    vi.mocked(hashPassword).mockResolvedValue("hash");
  });

  it("vuelve al carrito tras un login correcto", async () => {
    await expect(
      loginUser(
        AUTH_FORM_STATE_INICIAL,
        formulario({ ...CREDENCIALES, callbackUrl: "/carrito" }),
      ),
    ).rejects.toThrow("REDIRECT:/carrito");

    expect(redirect).toHaveBeenCalledWith("/carrito");
  });

  it("ignora un callback externo y usa el destino del rol", async () => {
    await expect(
      loginUser(
        AUTH_FORM_STATE_INICIAL,
        formulario({
          ...CREDENCIALES,
          callbackUrl: "https://evil.example",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/app");

    expect(redirect).toHaveBeenCalledWith("/app");
  });

  it("no deja que un cliente vuelva al panel", async () => {
    await expect(
      loginUser(
        AUTH_FORM_STATE_INICIAL,
        formulario({ ...CREDENCIALES, callbackUrl: "/admin" }),
      ),
    ).rejects.toThrow("REDIRECT:/app");

    expect(redirect).toHaveBeenCalledWith("/app");
  });

  it("permite al staff volver a una ruta del panel", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      role: "encargado",
    } as never);

    await expect(
      loginUser(
        AUTH_FORM_STATE_INICIAL,
        formulario({ ...CREDENCIALES, callbackUrl: "/admin/solicitudes" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/solicitudes");

    expect(redirect).toHaveBeenCalledWith("/admin/solicitudes");
  });

  it("conserva el callback al pasar por el registro", async () => {
    await expect(
      registerUser(
        AUTH_FORM_STATE_INICIAL,
        formulario({
          name: "Cliente Demo",
          email: "nuevo@demo.local",
          password: "Demo1234!",
          confirmPassword: "Demo1234!",
          callbackUrl: "/carrito",
        }),
      ),
    ).rejects.toThrow(
      "REDIRECT:/login?registrado=1&callbackUrl=%2Fcarrito",
    );

    expect(hashPassword).toHaveBeenCalledWith("Demo1234!");
    expect(redirect).toHaveBeenCalledWith(
      "/login?registrado=1&callbackUrl=%2Fcarrito",
    );
  });

  it("no conserva un callback de registro no seguro", async () => {
    await expect(
      registerUser(
        AUTH_FORM_STATE_INICIAL,
        formulario({
          name: "Cliente Demo",
          email: "nuevo@demo.local",
          password: "Demo1234!",
          confirmPassword: "Demo1234!",
          callbackUrl: "https://evil.example",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/login?registrado=1");

    expect(redirect).toHaveBeenCalledWith("/login?registrado=1");
  });
});
