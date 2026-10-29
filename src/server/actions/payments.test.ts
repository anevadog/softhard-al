import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_STATE_INICIAL } from "@/lib/form-state";

vi.mock("@/server/authorization", () => ({
  requerirStaff: vi.fn(),
}));

vi.mock("@/server/data/payments", () => ({
  registrarCobroPedido: vi.fn(),
  registrarCobroSolicitud: vi.fn(),
}));

vi.mock("@/server/data/orders", () => ({
  liberarPedidosCaducadosSinFallar: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { registrarCobroAction } from "@/server/actions/payments";
import { requerirStaff } from "@/server/authorization";
import { liberarPedidosCaducadosSinFallar } from "@/server/data/orders";
import {
  registrarCobroPedido,
  registrarCobroSolicitud,
} from "@/server/data/payments";

function formulario(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const valores = {
    entidad: "solicitud",
    id: "req-1",
    importe: "90,00",
    metodo: "efectivo",
    nota: "",
    ...overrides,
  };

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

describe("registrarCobroAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requerirStaff).mockResolvedValue({
      id: "staff-1",
      name: "Encargado",
      role: "encargado",
    });
    vi.mocked(registrarCobroSolicitud).mockResolvedValue({ ok: true });
    vi.mocked(registrarCobroPedido).mockResolvedValue({ ok: true });
  });

  it("registra el cobro de una solicitud con el rol revalidado y redirige", async () => {
    await expect(
      registrarCobroAction(FORM_STATE_INICIAL, formulario()),
    ).rejects.toThrow("REDIRECT:/admin/solicitudes/req-1?cobro=1");

    expect(registrarCobroSolicitud).toHaveBeenCalledWith({
      id: "req-1",
      importe: 90,
      metodo: "efectivo",
      nota: null,
      staff: { id: "staff-1", role: "encargado" },
    });
    expect(liberarPedidosCaducadosSinFallar).not.toHaveBeenCalled();
  });

  it("en un pedido libera antes los caducados", async () => {
    await expect(
      registrarCobroAction(FORM_STATE_INICIAL, formulario({ entidad: "pedido", id: "order-1" })),
    ).rejects.toThrow("REDIRECT:/admin/pedidos/order-1?cobro=1");

    expect(
      vi.mocked(liberarPedidosCaducadosSinFallar).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(registrarCobroPedido).mock.invocationCallOrder[0]);
  });

  it("traduce los rechazos de la capa de datos", async () => {
    vi.mocked(registrarCobroSolicitud).mockResolvedValue({
      ok: false,
      motivo: "importe-no-permitido",
    });

    const resultado = await registrarCobroAction(FORM_STATE_INICIAL, formulario());

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("Solo un administrador");
  });

  it("rechaza datos inválidos sin tocar la base", async () => {
    const resultado = await registrarCobroAction(
      FORM_STATE_INICIAL,
      formulario({ metodo: "tarjeta_online" }),
    );

    expect(resultado.status).toBe("error");
    expect(registrarCobroSolicitud).not.toHaveBeenCalled();
  });

  it("no ejecuta nada si el usuario no es staff", async () => {
    vi.mocked(requerirStaff).mockRejectedValue(new Error("REDIRECT:/app"));

    await expect(
      registrarCobroAction(FORM_STATE_INICIAL, formulario()),
    ).rejects.toThrow("REDIRECT:/app");
    expect(registrarCobroSolicitud).not.toHaveBeenCalled();
  });
});
