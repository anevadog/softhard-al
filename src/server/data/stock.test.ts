import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    product: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  ajustarStockProducto,
  listarMovimientosProducto,
} from "@/server/data/stock";

function crearTx() {
  return {
    product: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
  };
}

function configurarTransaccion(tx: ReturnType<typeof crearTx>) {
  const transaccion = prisma.$transaction as unknown as {
    mockImplementation: (
      impl: (
        callback: (client: Prisma.TransactionClient) => Promise<unknown>,
      ) => Promise<unknown>,
    ) => void;
  };

  transaccion.mockImplementation((callback) =>
    callback(tx as unknown as Prisma.TransactionClient),
  );
}

describe("ajustarStockProducto", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("suma una reposición y registra el movimiento con usuario", async () => {
    const tx = crearTx();
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    configurarTransaccion(tx);

    await expect(
      ajustarStockProducto({
        productId: "prod-1",
        variation: 5,
        reason: "reposicion",
        note: "Compra a proveedor",
        userId: "staff-1",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: "prod-1",
        active: true,
        stock: { gte: 0 },
      },
      data: { stock: { increment: 5 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-1",
        variation: 5,
        reason: "reposicion",
        note: "Compra a proveedor",
        userId: "staff-1",
      },
    });
  });

  it("resta un ajuste negativo solo si hay stock suficiente", async () => {
    const tx = crearTx();
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    configurarTransaccion(tx);

    await expect(
      ajustarStockProducto({
        productId: "prod-1",
        variation: -3,
        reason: "ajuste",
        note: "Rotura",
        userId: "staff-1",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: "prod-1",
        active: true,
        stock: { gte: 3 },
      },
      data: { stock: { increment: -3 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-1",
        variation: -3,
        reason: "ajuste",
        note: "Rotura",
        userId: "staff-1",
      },
    });
  });

  it("rechaza un ajuste que dejaría el stock en negativo", async () => {
    const tx = crearTx();
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    tx.product.findFirst.mockResolvedValue({ id: "prod-1" });
    configurarTransaccion(tx);

    await expect(
      ajustarStockProducto({
        productId: "prod-1",
        variation: -5,
        reason: "ajuste",
        note: "Rotura",
        userId: "staff-1",
      }),
    ).resolves.toEqual({ ok: false, motivo: "stock-insuficiente" });

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("rechaza productos inexistentes o archivados", async () => {
    const tx = crearTx();
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    tx.product.findFirst.mockResolvedValue(null);
    configurarTransaccion(tx);

    await expect(
      ajustarStockProducto({
        productId: "prod-archivado",
        variation: 2,
        reason: "reposicion",
        note: null,
        userId: "staff-1",
      }),
    ).resolves.toEqual({ ok: false, motivo: "no-disponible" });

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});

describe("listarMovimientosProducto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pide los últimos 10 movimientos con usuario y pedido", async () => {
    const movimientos = [
      {
        id: "mov-1",
        createdAt: new Date("2026-10-26T10:00:00.000Z"),
        reason: "venta" as const,
        variation: -1,
        note: null,
        user: { name: "Encargado Demo" },
        orderId: "order-1",
      },
    ];
    vi.mocked(prisma.stockMovement.findMany).mockResolvedValue(
      movimientos as never,
    );

    await expect(listarMovimientosProducto("prod-1")).resolves.toEqual(
      movimientos,
    );

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
      where: { productId: "prod-1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        createdAt: true,
        reason: true,
        variation: true,
        note: true,
        user: { select: { name: true } },
        orderId: true,
      },
    });
  });
});
