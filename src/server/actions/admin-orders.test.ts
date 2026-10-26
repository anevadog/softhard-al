import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_STATE_INICIAL } from "@/lib/form-state";

vi.mock("@/server/authorization", () => ({
  requerirStaff: vi.fn(),
}));

vi.mock("@/server/data/admin-orders", () => ({
  cambiarEstadoPedidoAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { cambiarEstadoPedidoAction } from "@/server/actions/admin-orders";
import { requerirStaff } from "@/server/authorization";
import { cambiarEstadoPedidoAdmin } from "@/server/data/admin-orders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function formulario(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const valores = {
    orderId: "order-1",
    estadoEsperado: "pendiente",
    estadoNuevo: "pagado",
    motivo: "",
    ...overrides,
  };

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

describe("cambiarEstadoPedidoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requerirStaff).mockResolvedValue({
      id: "staff-1",
      name: "Encargado Demo",
      role: "encargado",
    });
    vi.mocked(cambiarEstadoPedidoAdmin).mockResolvedValue({
      ok: true,
      productIds: [],
    });
  });

  it("cambia pendiente a pagado y redirige", async () => {
    await expect(
      cambiarEstadoPedidoAction(FORM_STATE_INICIAL, formulario()),
    ).rejects.toThrow("REDIRECT:/admin/pedidos/order-1?estado=1");

    expect(cambiarEstadoPedidoAdmin).toHaveBeenCalledWith({
      orderId: "order-1",
      estadoEsperado: "pendiente",
      estadoNuevo: "pagado",
      motivo: null,
      userId: "staff-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/pedidos");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/pedidos/order-1");
    expect(revalidatePath).toHaveBeenCalledWith("/app/pedidos");
    expect(revalidatePath).toHaveBeenCalledWith("/app/pedidos/order-1");
    expect(redirect).toHaveBeenCalledWith(
      "/admin/pedidos/order-1?estado=1",
    );
  });

  it("rechaza una transición no permitida sin llamar a datos", async () => {
    const resultado = await cambiarEstadoPedidoAction(
      FORM_STATE_INICIAL,
      formulario({ estadoNuevo: "entregado" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("no está permitido");
    expect(cambiarEstadoPedidoAdmin).not.toHaveBeenCalled();
  });

  it("exige motivo al cancelar un pedido pagado", async () => {
    const resultado = await cambiarEstadoPedidoAction(
      FORM_STATE_INICIAL,
      formulario({ estadoEsperado: "pagado", estadoNuevo: "cancelado" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.fieldErrors?.motivo?.[0]).toBeTruthy();
    expect(cambiarEstadoPedidoAdmin).not.toHaveBeenCalled();
  });

  it("cancela pagado con motivo y revalida el stock", async () => {
    vi.mocked(cambiarEstadoPedidoAdmin).mockResolvedValue({
      ok: true,
      productIds: ["prod-1", "prod-2"],
    });

    await expect(
      cambiarEstadoPedidoAction(
        FORM_STATE_INICIAL,
        formulario({
          estadoEsperado: "pagado",
          estadoNuevo: "cancelado",
          motivo: "Cliente desiste",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/pedidos/order-1?estado=1");

    expect(cambiarEstadoPedidoAdmin).toHaveBeenCalledWith({
      orderId: "order-1",
      estadoEsperado: "pagado",
      estadoNuevo: "cancelado",
      motivo: "Cliente desiste",
      userId: "staff-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/productos");
    expect(revalidatePath).toHaveBeenCalledWith("/productos");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/productos/prod-1");
    expect(revalidatePath).toHaveBeenCalledWith("/productos/prod-1");
  });

  it("devuelve un mensaje claro si pierde la carrera", async () => {
    vi.mocked(cambiarEstadoPedidoAdmin).mockResolvedValue({
      ok: false,
      motivo: "conflicto",
    });

    const resultado = await cambiarEstadoPedidoAction(
      FORM_STATE_INICIAL,
      formulario(),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("ha cambiado");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("no ejecuta nada si el usuario no es staff", async () => {
    vi.mocked(requerirStaff).mockRejectedValue(
      new Error("REDIRECT:/app"),
    );

    await expect(
      cambiarEstadoPedidoAction(FORM_STATE_INICIAL, formulario()),
    ).rejects.toThrow("REDIRECT:/app");

    expect(cambiarEstadoPedidoAdmin).not.toHaveBeenCalled();
  });
});
