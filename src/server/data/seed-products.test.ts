import { describe, expect, it, vi } from "vitest";

import {
  crearProductoSeedSiNoExiste,
  type ProductoSeed,
} from "@/server/data/seed-products";

const PRODUCTO: ProductoSeed = {
  id: "demo-prod-monitor-lg-24",
  name: "Monitor LG 24 pulgadas",
  description: "Monitor LED Full HD de 24 pulgadas.",
  price: "129.00",
  stock: 10,
  imageUrl: null,
  category: "accesorios",
};

function crearTx() {
  return {
    product: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
  };
}

describe("crearProductoSeedSiNoExiste", () => {
  it("no crea stock_inicial al reejecutar el seed sobre un producto existente", async () => {
    // El producto ya existe, su stock actual es 10 y no tiene stock_inicial.
    // El seed no debe inventar un movimiento con ese stock.
    const tx = crearTx();
    tx.product.findUnique.mockResolvedValue({ id: PRODUCTO.id });

    await expect(
      crearProductoSeedSiNoExiste(tx as never, PRODUCTO),
    ).resolves.toBe(false);

    expect(tx.product.create).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("crea el stock_inicial con el stock demo, no con el stock de la base", async () => {
    const tx = crearTx();
    tx.product.findUnique.mockResolvedValue(null);
    tx.product.create.mockResolvedValue({
      id: PRODUCTO.id,
      stock: 999,
    });

    await expect(
      crearProductoSeedSiNoExiste(tx as never, PRODUCTO),
    ).resolves.toBe(true);

    expect(tx.product.create).toHaveBeenCalledWith({ data: PRODUCTO });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: PRODUCTO.id,
        variation: 10,
        reason: "stock_inicial",
        userId: null,
        note: "Stock inicial del seed",
      },
    });
  });

  it("crea el producto pero no un movimiento si el stock demo es 0", async () => {
    const tx = crearTx();
    tx.product.findUnique.mockResolvedValue(null);
    tx.product.create.mockResolvedValue({
      id: PRODUCTO.id,
      stock: 999,
    });

    await expect(
      crearProductoSeedSiNoExiste(tx as never, {
        ...PRODUCTO,
        stock: 0,
      }),
    ).resolves.toBe(true);

    expect(tx.product.create).toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
