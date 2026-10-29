import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    order: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  crearPedidoCliente,
  liberarPedidosCaducados,
  liberarPedidosCaducadosSinFallar,
  listarPedidosCliente,
  obtenerPedidoCliente,
} from "@/server/data/orders";

const CLAVE = "123e4567-e89b-42d3-a456-426614174000";

function crearTx() {
  return {
    config: {
      findUnique: vi.fn().mockResolvedValue({ pendingOrderHours: 48 }),
    },
    product: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    order: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
    },
    stockMovement: {
      createMany: vi.fn(),
    },
  };
}

type TxMock = ReturnType<typeof crearTx>;

function configurarTransaccion(tx: TxMock) {
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

function productosDePrueba() {
  return [
    { id: "prod-b", price: "5.00", stock: 10, active: true },
    { id: "prod-a", price: "19.99", stock: 5, active: true },
  ];
}

describe("creación de pedidos", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);
    // Sin pedidos vencidos que liberar antes del checkout.
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
  });

  it("descuenta el stock en orden y crea el pedido con precios congelados", async () => {
    const tx = crearTx();
    tx.product.findMany.mockResolvedValue(productosDePrueba() as never);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({ id: "order-1" });
    tx.stockMovement.createMany.mockResolvedValue({ count: 2 });
    configurarTransaccion(tx);

    const resultado = await crearPedidoCliente(
      "user-1",
      [
        { productId: "prod-b", quantity: 2 },
        { productId: "prod-a", quantity: 3 },
      ],
      CLAVE,
    );

    expect(resultado).toEqual({ ok: true, pedidoId: "order-1" });
    expect(tx.product.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "prod-a",
        active: true,
        stock: { gte: 3 },
      },
      data: { stock: { decrement: 3 } },
    });
    expect(tx.product.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "prod-b",
        active: true,
        stock: { gte: 2 },
      },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.order.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        total: "69.97",
        status: "pendiente",
        idempotencyKey: CLAVE,
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date),
        items: {
          create: [
            { productId: "prod-b", quantity: 2, price: "5.00" },
            { productId: "prod-a", quantity: 3, price: "19.99" },
          ],
        },
      },
      select: { id: true },
    });
    const { createdAt, expiresAt } = tx.order.create.mock.calls[0][0].data;
    expect(expiresAt.getTime() - createdAt.getTime()).toBe(48 * 60 * 60 * 1000);
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
          variation: -3,
          reason: "venta",
          orderId: "order-1",
        },
      ],
    });
  });

  it("usa las horas de Config y, sin fila de Config, 48 h", async () => {
    const tx = crearTx();
    tx.config.findUnique.mockResolvedValueOnce({ pendingOrderHours: 2 });
    tx.product.findMany.mockResolvedValue(productosDePrueba() as never);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({ id: "order-1" });
    configurarTransaccion(tx);

    await crearPedidoCliente("user-1", [{ productId: "prod-a", quantity: 1 }], CLAVE);
    tx.config.findUnique.mockResolvedValueOnce(null);
    await crearPedidoCliente("user-1", [{ productId: "prod-a", quantity: 1 }], CLAVE);

    const horas = tx.order.create.mock.calls.map(([{ data }]) =>
      (data.expiresAt.getTime() - data.createdAt.getTime()) / (60 * 60 * 1000),
    );
    expect(horas).toEqual([2, 48]);
  });

  it("libera los pedidos vencidos antes de comprobar el stock", async () => {
    const tx = crearTx();
    const eventos: string[] = [];
    vi.mocked(prisma.order.findMany).mockImplementation((async () => {
      eventos.push("buscar-vencidos");
      return [];
    }) as never);
    tx.product.findMany.mockImplementation(async () => {
      eventos.push("leer-stock");
      return productosDePrueba();
    });
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({ id: "order-1" });
    configurarTransaccion(tx);

    await crearPedidoCliente("user-1", [{ productId: "prod-a", quantity: 1 }], CLAVE);

    expect(eventos).toEqual(["buscar-vencidos", "leer-stock"]);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "pendiente", expiresAt: { lte: expect.any(Date) } },
        take: 50,
      }),
    );
  });

  it("aborta el checkout si falla la liberación de caducados", async () => {
    vi.mocked(prisma.order.findMany).mockRejectedValue(new Error("bd caída"));

    await expect(
      crearPedidoCliente("user-1", [{ productId: "prod-a", quantity: 1 }], CLAVE),
    ).rejects.toThrow("bd caída");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("crea el pedido antes que sus movimientos de venta", async () => {
    const tx = crearTx();
    const eventos: string[] = [];
    tx.product.findMany.mockResolvedValue(productosDePrueba() as never);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockImplementation(async () => {
      eventos.push("pedido");
      return { id: "order-1" };
    });
    tx.stockMovement.createMany.mockImplementation(async () => {
      eventos.push("movimientos");
      return { count: 2 };
    });
    configurarTransaccion(tx);

    await crearPedidoCliente(
      "user-1",
      [
        { productId: "prod-b", quantity: 2 },
        { productId: "prod-a", quantity: 3 },
      ],
      CLAVE,
    );

    expect(eventos).toEqual(["pedido", "movimientos"]);
  });

  it("devuelve el pedido existente sin abrir transacción", async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: "order-previo",
    } as never);

    const resultado = await crearPedidoCliente(
      "user-1",
      [{ productId: "prod-a", quantity: 1 }],
      CLAVE,
    );

    expect(resultado).toEqual({ ok: true, pedidoId: "order-previo" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("no actualiza stock ni crea pedido si falta disponibilidad", async () => {
    const tx = crearTx();
    tx.product.findMany.mockResolvedValue([
      { id: "prod-a", price: "19.99", stock: 1, active: true },
    ] as never);
    configurarTransaccion(tx);

    const resultado = await crearPedidoCliente(
      "user-1",
      [{ productId: "prod-a", quantity: 2 }],
      CLAVE,
    );

    expect(resultado).toEqual({
      ok: false,
      motivo: "stock-insuficiente",
      productIds: ["prod-a"],
    });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("revierte la transacción si otro usuario se lleva la última unidad", async () => {
    const tx = crearTx();
    tx.product.findMany.mockResolvedValue([
      { id: "prod-a", price: "19.99", stock: 1, active: true },
    ] as never);
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    configurarTransaccion(tx);

    const resultado = await crearPedidoCliente(
      "user-1",
      [{ productId: "prod-a", quantity: 1 }],
      CLAVE,
    );

    expect(resultado).toEqual({
      ok: false,
      motivo: "stock-insuficiente",
      productIds: ["prod-a"],
    });
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
    expect(prisma.order.findFirst).toHaveBeenCalledTimes(2);
  });

  it("si la carrera ya creó el mismo idempotencyKey, devuelve ese pedido", async () => {
    const tx = crearTx();
    tx.product.findMany.mockResolvedValue(productosDePrueba() as never);
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    configurarTransaccion(tx);
    vi.mocked(prisma.order.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "order-carrera" } as never);

    const resultado = await crearPedidoCliente(
      "user-1",
      [{ productId: "prod-a", quantity: 1 }],
      CLAVE,
    );

    expect(resultado).toEqual({ ok: true, pedidoId: "order-carrera" });
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("detecta un producto inactivo", async () => {
    const tx = crearTx();
    tx.product.findMany.mockResolvedValue([
      { id: "prod-a", price: "19.99", stock: 5, active: false },
    ] as never);
    configurarTransaccion(tx);

    const resultado = await crearPedidoCliente(
      "user-1",
      [{ productId: "prod-a", quantity: 1 }],
      CLAVE,
    );

    expect(resultado).toEqual({
      ok: false,
      motivo: "producto-no-disponible",
      productIds: ["prod-a"],
    });
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("resuelve una violación de unicidad consultando la clave idempotente", async () => {
    const tx = crearTx();
    tx.product.findMany.mockResolvedValue(productosDePrueba() as never);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockRejectedValue({ code: "P2002" } as never);
    configurarTransaccion(tx);
    vi.mocked(prisma.order.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "order-unico" } as never);

    const resultado = await crearPedidoCliente(
      "user-1",
      [{ productId: "prod-a", quantity: 1 }],
      CLAVE,
    );

    expect(resultado).toEqual({ ok: true, pedidoId: "order-unico" });
    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("no crea movimientos si falla la creación del pedido", async () => {
    const tx = crearTx();
    tx.product.findMany.mockResolvedValue(productosDePrueba() as never);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockRejectedValue(new Error("order"));
    configurarTransaccion(tx);

    await expect(
      crearPedidoCliente(
        "user-1",
        [{ productId: "prod-a", quantity: 1 }],
        CLAVE,
      ),
    ).rejects.toThrow("order");

    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("propaga el fallo al crear los movimientos para revertir el pedido", async () => {
    const tx = crearTx();
    tx.product.findMany.mockResolvedValue(productosDePrueba() as never);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.order.create.mockResolvedValue({ id: "order-1" });
    tx.stockMovement.createMany.mockRejectedValue(new Error("movement"));
    configurarTransaccion(tx);

    await expect(
      crearPedidoCliente(
        "user-1",
        [{ productId: "prod-a", quantity: 1 }],
        CLAVE,
      ),
    ).rejects.toThrow("movement");
  });

  it("propaga los errores inesperados", async () => {
    const tx = crearTx();
    tx.product.findMany.mockRejectedValue(new Error("boom"));
    configurarTransaccion(tx);

    await expect(
      crearPedidoCliente(
        "user-1",
        [{ productId: "prod-a", quantity: 1 }],
        CLAVE,
      ),
    ).rejects.toThrow("boom");
  });
});

describe("lectura de pedidos", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lista los pedidos del cliente con unidades y líneas", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        id: "order-1",
        total: "69.97",
        status: "pendiente",
        createdAt: new Date("2026-10-24T10:00:00Z"),
        expiresAt: new Date("2026-10-26T10:00:00Z"),
        items: [{ quantity: 2 }, { quantity: 3 }],
      },
    ] as never);

    const pedidos = await listarPedidosCliente("user-1");

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        items: { select: { quantity: true } },
      },
    });
    expect(pedidos).toEqual([
      {
        id: "order-1",
        total: 69.97,
        status: "pendiente",
        createdAt: new Date("2026-10-24T10:00:00Z"),
        expiresAt: new Date("2026-10-26T10:00:00Z"),
        unidades: 5,
        lineas: 2,
      },
    ]);
  });

  it("obtiene el detalle solo si pertenece al usuario", async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: "order-1",
      total: "59.97",
      status: "pendiente",
      createdAt: new Date("2026-10-24T10:00:00Z"),
      items: [
        {
          id: "item-1",
          productId: "prod-a",
          quantity: 3,
          price: "19.99",
          product: { name: "Producto A", imageUrl: null },
        },
      ],
    } as never);

    const pedido = await obtenerPedidoCliente("order-1", "user-1");

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1", userId: "user-1" },
      }),
    );
    expect(pedido).toEqual({
      id: "order-1",
      total: 59.97,
      status: "pendiente",
      createdAt: new Date("2026-10-24T10:00:00Z"),
      items: [
        {
          id: "item-1",
          productId: "prod-a",
          productName: "Producto A",
          imageUrl: null,
          quantity: 3,
          price: 19.99,
          subtotal: 59.97,
        },
      ],
    });
  });

  it("devuelve null para un pedido ajeno o inexistente", async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);

    await expect(obtenerPedidoCliente("order-x", "user-1")).resolves.toBeNull();
  });
});

describe("liberación de pedidos caducados", () => {
  const AHORA = new Date("2026-10-28T12:00:00Z");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("caduca el pedido y repone stock con movimientos de caducidad sin usuario", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ id: "order-1" }] as never);
    const tx = crearTx();
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.orderItem.findMany.mockResolvedValue([
      { productId: "prod-a", quantity: 2 },
      { productId: "prod-b", quantity: 1 },
    ]);
    configurarTransaccion(tx);

    await expect(liberarPedidosCaducados(AHORA)).resolves.toBe(1);

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "pendiente", expiresAt: { lte: AHORA } },
      data: { status: "caducado" },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "prod-a" },
      data: { stock: { increment: 2 } },
    });
    expect(tx.stockMovement.createMany).toHaveBeenCalledWith({
      data: [
        { productId: "prod-a", variation: 2, reason: "caducidad_pedido", orderId: "order-1" },
        { productId: "prod-b", variation: 1, reason: "caducidad_pedido", orderId: "order-1" },
      ],
    });
  });

  it("no repone nada si otra llamada o una cancelación ganó la carrera", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ id: "order-1" }] as never);
    const tx = crearTx();
    tx.order.updateMany.mockResolvedValue({ count: 0 });
    configurarTransaccion(tx);

    await expect(liberarPedidosCaducados(AHORA)).resolves.toBe(0);

    expect(tx.orderItem.findMany).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("la versión sin fallar registra el error y no lo propaga", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(prisma.order.findMany).mockRejectedValue(new Error("bd caída"));

    await expect(liberarPedidosCaducadosSinFallar()).resolves.toBeUndefined();
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });
});
