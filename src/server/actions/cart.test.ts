import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/data/products", () => ({
  listarProductosPorIds: vi.fn(),
}));

vi.mock("@/server/data/orders", () => ({
  liberarPedidosCaducadosSinFallar: vi.fn(),
}));

import { obtenerProductosCarritoAction } from "@/server/actions/cart";
import { liberarPedidosCaducadosSinFallar } from "@/server/data/orders";
import { listarProductosPorIds } from "@/server/data/products";

const PRODUCTOS = [
  {
    id: "prod-a",
    name: "Producto A",
    description: "Descripción del producto A",
    price: 10,
    stock: 3,
    imageUrl: null,
    category: "accesorios" as const,
  },
];

describe("acción de lectura del carrito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarProductosPorIds).mockResolvedValue(PRODUCTOS);
  });

  it("consulta los IDs válidos y elimina duplicados", async () => {
    const resultado = await obtenerProductosCarritoAction([
      "prod-a",
      "prod-a",
      "prod-b",
    ]);

    expect(listarProductosPorIds).toHaveBeenCalledWith(["prod-a", "prod-b"]);
    expect(resultado).toEqual(PRODUCTOS);
  });

  it("libera los pedidos caducados antes de leer el stock", async () => {
    await obtenerProductosCarritoAction(["prod-a"]);

    expect(
      vi.mocked(liberarPedidosCaducadosSinFallar).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(listarProductosPorIds).mock.invocationCallOrder[0]);
  });

  it("no consulta la base de datos con IDs inválidos", async () => {
    const resultado = await obtenerProductosCarritoAction([""]);

    expect(resultado).toEqual([]);
    expect(listarProductosPorIds).not.toHaveBeenCalled();
    expect(liberarPedidosCaducadosSinFallar).not.toHaveBeenCalled();
  });

  it("no consulta si el carrito supera el máximo de líneas", async () => {
    const ids = Array.from({ length: 51 }, (_, index) => `prod-${index}`);
    const resultado = await obtenerProductosCarritoAction(ids);

    expect(resultado).toEqual([]);
    expect(listarProductosPorIds).not.toHaveBeenCalled();
  });
});
