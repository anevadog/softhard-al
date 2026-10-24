import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/data/orders", () => ({
  crearPedidoCliente: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { auth } from "@/lib/auth";
import { finalizarCompraAction } from "@/server/actions/orders";
import { crearPedidoCliente } from "@/server/data/orders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const CLAVE = "123e4567-e89b-42d3-a456-426614174000";
const authMock = vi.mocked(auth as unknown as () => Promise<unknown>);

function payload() {
  return {
    items: [
      { productId: "prod-a", quantity: 2 },
      { productId: "prod-b", quantity: 1 },
    ],
    idempotencyKey: CLAVE,
  };
}

describe("acción de finalizar compra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "cliente" },
    });
    vi.mocked(crearPedidoCliente).mockResolvedValue({
      ok: true,
      pedidoId: "order-1",
    });
  });

  it("redirige al login si no hay sesión", async () => {
    authMock.mockResolvedValue(null);

    await expect(finalizarCompraAction(payload())).rejects.toThrow(
      "REDIRECT:/login?callbackUrl=/carrito",
    );

    expect(crearPedidoCliente).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/login?callbackUrl=/carrito");
  });

  it("no escribe si el payload no es válido", async () => {
    const resultado = await finalizarCompraAction({
      items: [],
      idempotencyKey: CLAVE,
    });

    expect(resultado).toMatchObject({
      ok: false,
      motivo: "datos-invalidos",
    });
    expect(crearPedidoCliente).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("crea el pedido, revalida y devuelve el identificador", async () => {
    const resultado = await finalizarCompraAction(payload());

    expect(crearPedidoCliente).toHaveBeenCalledWith("user-1", payload().items, CLAVE);
    expect(resultado).toEqual({ ok: true, pedidoId: "order-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/productos");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/productos");
    expect(revalidatePath).toHaveBeenCalledWith("/app/pedidos");
  });

  it("informa de un conflicto de stock y refresca el catálogo", async () => {
    vi.mocked(crearPedidoCliente).mockResolvedValue({
      ok: false,
      motivo: "stock-insuficiente",
      productIds: ["prod-a"],
    });

    const resultado = await finalizarCompraAction(payload());

    expect(resultado).toMatchObject({
      ok: false,
      motivo: "stock-insuficiente",
      productIds: ["prod-a"],
    });
    expect(resultado.ok ? "" : resultado.message).toContain("stock suficiente");
    expect(revalidatePath).toHaveBeenCalledWith("/productos");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/productos");
  });

  it("devuelve un mensaje genérico ante un fallo inesperado", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(crearPedidoCliente).mockRejectedValue(new Error("boom"));

    const resultado = await finalizarCompraAction(payload());

    expect(resultado).toMatchObject({ ok: false, motivo: "error" });
    expect(resultado.ok ? "" : resultado.message).toContain("No se pudo crear");
    expect(errorSpy).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
