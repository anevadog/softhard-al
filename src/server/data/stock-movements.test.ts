import { describe, expect, it, vi } from "vitest";

import {
  crearMovimientoStockInicial,
  crearMovimientosVenta,
} from "@/server/data/stock-movements";

function crearTx() {
  return {
    stockMovement: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  };
}

describe("movimientos de stock", () => {
  it("crea el stock inicial positivo con usuario nulo", async () => {
    const tx = crearTx();

    await crearMovimientoStockInicial(tx as never, {
      productId: "prod-a",
      stock: 5,
      note: "Alta de producto",
    });

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-a",
        variation: 5,
        reason: "stock_inicial",
        userId: null,
        note: "Alta de producto",
      },
    });
  });

  it("no crea stock inicial para un producto con stock 0", async () => {
    const tx = crearTx();

    await crearMovimientoStockInicial(tx as never, {
      productId: "prod-a",
      stock: 0,
    });

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("crea un movimiento de venta negativo por cada línea", async () => {
    const tx = crearTx();

    await crearMovimientosVenta(tx as never, "order-1", [
      { productId: "prod-b", quantity: 2 },
      { productId: "prod-a", quantity: 1 },
    ]);

    expect(tx.stockMovement.createMany).toHaveBeenCalledWith({
      data: [
        {
          productId: "prod-b",
          variation: -2,
          reason: "venta",
          orderId: "order-1",
        },
        {
          productId: "prod-a",
          variation: -1,
          reason: "venta",
          orderId: "order-1",
        },
      ],
    });
  });

  it("no llama a la base si el pedido no tiene líneas", async () => {
    const tx = crearTx();

    await crearMovimientosVenta(tx as never, "order-1", []);

    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });
});
