import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requerirPersonalTaller } from "@/server/authorization";
import { redirect } from "next/navigation";

const authMock = vi.mocked(
  auth as unknown as () => Promise<{ user?: { id: string } } | null>,
);

describe("requerirPersonalTaller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve al trabajador autenticado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Trabajador Demo",
      role: "trabajador",
    } as never);

    await expect(requerirPersonalTaller()).resolves.toEqual({
      id: "user-1",
      name: "Trabajador Demo",
      role: "trabajador",
    });
  });

  it("permite también a encargado y admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user-2" } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-2",
      name: "Encargado Demo",
      role: "encargado",
    } as never);

    await expect(requerirPersonalTaller()).resolves.toMatchObject({
      role: "encargado",
    });
  });

  it("redirige al login si no hay sesión", async () => {
    authMock.mockResolvedValue(null);

    await expect(requerirPersonalTaller()).rejects.toThrow(
      "REDIRECT:/login?callbackUrl=/trabajador",
    );
    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=/trabajador");
  });

  it("redirige a /app si el rol no es de taller", async () => {
    authMock.mockResolvedValue({ user: { id: "user-3" } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-3",
      name: "Cliente Demo",
      role: "cliente",
    } as never);

    await expect(requerirPersonalTaller()).rejects.toThrow("REDIRECT:/app");
    expect(redirect).toHaveBeenCalledWith("/app");
  });

  it("redirige a /app si el usuario ya no existe", async () => {
    authMock.mockResolvedValue({ user: { id: "user-4" } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(requerirPersonalTaller()).rejects.toThrow("REDIRECT:/app");
    expect(redirect).toHaveBeenCalledWith("/app");
  });
});
