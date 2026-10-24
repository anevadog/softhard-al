import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/data/products", () => ({
  listarProductosPorIds: vi.fn(),
}));

import { obtenerProductosCarritoAction } from "@/server/actions/cart";
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

  it("no consulta la base de datos con IDs inválidos", async () => {
    const resultado = await obtenerProductosCarritoAction([""]);

    expect(resultado).toEqual([]);
    expect(listarProductosPorIds).not.toHaveBeenCalled();
  });

  it("no consulta si el carrito supera el máximo de líneas", async () => {
    const ids = Array.from({ length: 51 }, (_, index) => `prod-${index}`);
    const resultado = await obtenerProductosCarritoAction(ids);

    expect(resultado).toEqual([]);
    expect(listarProductosPorIds).not.toHaveBeenCalled();
  });
});
