import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { obtenerProductoPublico } from "@/server/data/products";

const PRODUCTO = {
  id: "demo-prod-keychron-k2",
  name: "Teclado mecánico Keychron K2",
  description: "Teclado mecánico inalámbrico con retroiluminación.",
  price: "49.90",
  stock: 12,
  imageUrl: null,
  category: "accesorios" as const,
};

describe("obtenerProductoPublico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve el producto activo con el precio como número", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(PRODUCTO as never);

    await expect(
      obtenerProductoPublico("demo-prod-keychron-k2"),
    ).resolves.toEqual({
      ...PRODUCTO,
      price: 49.9,
    });

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: "demo-prod-keychron-k2", active: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        imageUrl: true,
        category: true,
      },
    });
  });

  it("devuelve null para un producto inexistente", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

    await expect(obtenerProductoPublico("producto-inexistente")).resolves.toBeNull();
  });

  it("filtra los productos archivados o inactivos", async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);

    await expect(
      obtenerProductoPublico("producto-archivado"),
    ).resolves.toBeNull();

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "producto-archivado", active: true },
      }),
    );
  });

  it("propaga los errores inesperados de la base de datos", async () => {
    vi.mocked(prisma.product.findFirst).mockRejectedValue(new Error("boom"));

    await expect(obtenerProductoPublico("prod-1")).rejects.toThrow("boom");
  });
});
