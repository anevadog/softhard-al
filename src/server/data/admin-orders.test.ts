import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// La pasarela (5.3) se prueba en integración; aquí no hay sesiones de pago.
vi.mock("@/server/data/online-payments", () => ({
  marcarReembolsoPorCancelacionEnTx: vi.fn().mockResolvedValue([]),
  ejecutarReembolsos: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    order: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  cambiarEstadoPedidoAdmin,
  contarPedidosPorEstado,
  listarPedidosAdmin,
  obtenerPedidoAdmin,
} from "@/server/data/admin-orders";

function crearTx() {
  return {
    // Bloqueo de fila (SELECT … FOR UPDATE) antes de comprobar facturas.
    $queryRaw: vi.fn().mockResolvedValue([{ id: "fila" }]),
    // Sin facturas: ningún bloqueo por factura vigente.
    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    order: {
      updateMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
    },
    product: {
      update: vi.fn(),
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

describe("listarPedidosAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra por estado y convierte el total", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        id: "order-1",
        total: "25.50",
        status: "pagado",
        createdAt: new Date("2026-10-26T10:00:00.000Z"),
        user: {
          name: "Cliente Demo",
          email: "cliente@example.com",
          phone: null,
        },
      },
    ] as never);

    await expect(listarPedidosAdmin("pagado")).resolves.toEqual([
      {
        id: "order-1",
        total: 25.5,
        status: "pagado",
        createdAt: new Date("2026-10-26T10:00:00.000Z"),
        client: {
          name: "Cliente Demo",
          email: "cliente@example.com",
          phone: null,
        },
      },
    ]);

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { status: "pagado" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });
  });
});

describe("contarPedidosPorEstado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inicializa a cero los estados sin pedidos", async () => {
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      { status: "pendiente", _count: 2 },
    ] as never);

    await expect(contarPedidosPorEstado()).resolves.toEqual({
      pendiente: 2,
      pagado: 0,
      entregado: 0,
      cancelado: 0,
      caducado: 0,
    });
  });
});

describe("obtenerPedidoAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve las líneas con precio congelado y subtotal", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "order-1",
      total: "59.90",
      status: "pagado",
      createdAt: new Date("2026-10-26T10:00:00.000Z"),
      expiresAt: null,
      paidAt: new Date("2026-10-26T11:00:00.000Z"),
      paidAmount: "59.90",
      paymentMethod: "bizum",
      paymentNote: null,
      paidBy: { name: "Encargado Demo" },
      user: {
        name: "Cliente Demo",
        email: "cliente@example.com",
        phone: "600000000",
      },
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          quantity: 2,
          price: "29.95",
          product: { name: "Teclado" },
        },
      ],
    } as never);

    await expect(obtenerPedidoAdmin("order-1")).resolves.toEqual({
      id: "order-1",
      total: 59.9,
      status: "pagado",
      createdAt: new Date("2026-10-26T10:00:00.000Z"),
      expiresAt: null,
      cobro: {
        paidAt: new Date("2026-10-26T11:00:00.000Z"),
        paidAmount: 59.9,
        paymentMethod: "bizum",
        paidByName: "Encargado Demo",
        paymentNote: null,
      },
      client: {
        name: "Cliente Demo",
        email: "cliente@example.com",
        phone: "600000000",
      },
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Teclado",
          quantity: 2,
          price: 29.95,
          subtotal: 59.9,
        },
      ],
    });
  });

  it("devuelve null para un pedido inexistente", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    await expect(obtenerPedidoAdmin("order-inexistente")).resolves.toBeNull();
  });
});

describe("cambiarEstadoPedidoAdmin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rechaza una transición no permitida sin tocar la base", async () => {
    await expect(
      cambiarEstadoPedidoAdmin({
        orderId: "order-1",
        estadoEsperado: "pendiente",
        estadoNuevo: "entregado",
        userId: "staff-1",
        motivo: null,
      }),
    ).resolves.toEqual({ ok: false, motivo: "transicion-invalida" });

    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("cambia un pedido solo si sigue en el estado esperado", async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 });

    await expect(
      cambiarEstadoPedidoAdmin({
        orderId: "order-1",
        estadoEsperado: "pagado",
        estadoNuevo: "entregado",
        userId: "staff-1",
        motivo: null,
      }),
    ).resolves.toEqual({ ok: true, productIds: [] });

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "pagado" },
      data: { status: "entregado" },
    });
  });

  it("no marca pagado a mano: el cobro se registra aparte", async () => {
    await expect(
      cambiarEstadoPedidoAdmin({
        orderId: "order-1",
        estadoEsperado: "pendiente",
        estadoNuevo: "pagado",
        userId: "staff-1",
        motivo: null,
      }),
    ).resolves.toEqual({ ok: false, motivo: "transicion-invalida" });

    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("devuelve conflicto si el estado esperado ya no coincide", async () => {
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      cambiarEstadoPedidoAdmin({
        orderId: "order-1",
        estadoEsperado: "pagado",
        estadoNuevo: "entregado",
        userId: "staff-1",
        motivo: null,
      }),
    ).resolves.toEqual({ ok: false, motivo: "conflicto" });
  });

  it("cancela, repone todas las líneas y crea un movimiento por línea", async () => {
    const tx = crearTx();
    const eventos: string[] = [];

    tx.order.updateMany.mockImplementation(async () => {
      eventos.push("estado");
      return { count: 1 };
    });
    tx.orderItem.findMany.mockImplementation(async () => {
      eventos.push("lineas");
      return [
        { productId: "prod-activo", quantity: 2 },
        { productId: "prod-archivado", quantity: 1 },
      ];
    });
    tx.product.update.mockImplementation(async ({ where }) => {
      eventos.push(`stock:${where.id}`);
      return {};
    });
    tx.stockMovement.create.mockImplementation(async ({ data }) => {
      eventos.push(`mov:${data.productId}`);
      return {};
    });
    configurarTransaccion(tx);

    await expect(
      cambiarEstadoPedidoAdmin({
        orderId: "order-1",
        estadoEsperado: "pagado",
        estadoNuevo: "cancelado",
        userId: "staff-1",
        motivo: "Cliente desiste",
      }),
    ).resolves.toEqual({
      ok: true,
      productIds: ["prod-activo", "prod-archivado"],
    });

    expect(eventos).toEqual([
      "estado",
      "lineas",
      "stock:prod-activo",
      "mov:prod-activo",
      "stock:prod-archivado",
      "mov:prod-archivado",
    ]);

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "prod-archivado" },
      data: { stock: { increment: 1 } },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-archivado",
        variation: 1,
        reason: "cancelacion_pedido",
        orderId: "order-1",
        userId: "staff-1",
        note: "Cliente desiste",
      },
    });
  });

  it("una segunda cancelación no repone stock otra vez", async () => {
    const tx = crearTx();
    let llamadas = 0;

    tx.order.updateMany.mockImplementation(async () => {
      llamadas += 1;
      return { count: llamadas === 1 ? 1 : 0 };
    });
    tx.orderItem.findMany.mockResolvedValue([
      { productId: "prod-1", quantity: 2 },
    ]);
    configurarTransaccion(tx);

    const datos = {
      orderId: "order-1",
      estadoEsperado: "pendiente" as const,
      estadoNuevo: "cancelado" as const,
      userId: "staff-1",
      motivo: null,
    };

    await expect(cambiarEstadoPedidoAdmin(datos)).resolves.toEqual({
      ok: true,
      productIds: ["prod-1"],
    });
    await expect(cambiarEstadoPedidoAdmin(datos)).resolves.toEqual({
      ok: false,
      motivo: "conflicto",
    });

    expect(tx.orderItem.findMany).toHaveBeenCalledTimes(1);
    expect(tx.product.update).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
  });
});
