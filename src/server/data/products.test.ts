import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    product: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  actualizarProducto,
  crearProducto,
  obtenerProductoPublico,
} from "@/server/data/products";

const PRODUCTO = {
  id: "demo-prod-keychron-k2",
  name: "Teclado mecánico Keychron K2",
  description: "Teclado mecánico inalámbrico con retroiluminación.",
  price: "49.90",
  stock: 12,
  imageUrl: null,
  category: "accesorios" as const,
};

const DATOS_PRODUCTO = {
  name: "Producto nuevo",
  description: "Descripción suficientemente larga para el alta.",
  price: 49.9,
  stock: 5,
  imageUrl: null,
  category: "accesorios" as const,
};

function crearTx() {
  return {
    product: {
      create: vi.fn(),
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

describe("crearProducto", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("crea el producto y su stock_inicial en la misma transacción", async () => {
    const tx = crearTx();
    tx.product.create.mockResolvedValue({ id: "prod-nuevo", stock: 5 });
    configurarTransaccion(tx);

    await expect(crearProducto(DATOS_PRODUCTO)).resolves.toEqual({
      id: "prod-nuevo",
    });

    expect(tx.product.create).toHaveBeenCalledWith({
      data: {
        ...DATOS_PRODUCTO,
        price: "49.90",
      },
      select: { id: true, stock: true },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-nuevo",
        variation: 5,
        reason: "stock_inicial",
        userId: null,
        note: "Stock inicial del alta",
      },
    });
  });

  it("no crea movimiento si el alta tiene stock 0", async () => {
    const tx = crearTx();
    tx.product.create.mockResolvedValue({ id: "prod-nuevo", stock: 0 });
    configurarTransaccion(tx);

    await expect(
      crearProducto({ ...DATOS_PRODUCTO, stock: 0 }),
    ).resolves.toEqual({ id: "prod-nuevo" });

    expect(tx.product.create).toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("propaga el fallo del movimiento para revertir el alta", async () => {
    const tx = crearTx();
    tx.product.create.mockResolvedValue({ id: "prod-nuevo", stock: 5 });
    tx.stockMovement.create.mockRejectedValue(new Error("movement"));
    configurarTransaccion(tx);

    await expect(crearProducto(DATOS_PRODUCTO)).rejects.toThrow("movement");
  });
});

describe("actualizarProducto", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("actualiza los campos editables sin escribir stock", async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 });

    const datosConStock = { ...DATOS_PRODUCTO, stock: 999 };

    await expect(
      actualizarProducto("prod-1", datosConStock as never),
    ).resolves.toBe(true);

    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: "prod-1", active: true },
      data: {
        name: DATOS_PRODUCTO.name,
        description: DATOS_PRODUCTO.description,
        price: "49.90",
        imageUrl: null,
        category: "accesorios",
      },
    });
  });

  it("devuelve false si el producto no existe o está archivado", async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      actualizarProducto("prod-archivado", DATOS_PRODUCTO),
    ).resolves.toBe(false);
  });
});
