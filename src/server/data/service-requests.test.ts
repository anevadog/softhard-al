import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    serviceRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  decidirPresupuestoCliente,
  expirarPresupuestosVencidos,
} from "@/server/data/service-requests";

function crearTx() {
  return {
    serviceRequest: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    quote: {
      updateMany: vi.fn(),
    },
    serviceStatusHistory: {
      create: vi.fn(),
    },
    workLog: {
      updateMany: vi.fn(),
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

  transaccion.mockImplementation(async (callback) =>
    callback(tx as unknown as Prisma.TransactionClient),
  );
}

describe("transiciones no manuales", () => {
  let tx: TxMock;
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    tx = crearTx();
    tx.serviceRequest.findMany.mockResolvedValue([]);
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.quote.updateMany.mockResolvedValue({ count: 1 });
    tx.serviceStatusHistory.create.mockResolvedValue({} as never);
    tx.workLog.updateMany.mockResolvedValue({ count: 0 });
    configurarTransaccion(tx);
  });

  it("registra el historial cuando el cliente acepta el presupuesto", async () => {
    vi.mocked(prisma.serviceRequest.findFirst).mockResolvedValue({
      status: "diagnosticada",
      quote: {
        status: "pendiente",
        expiresAt: manana,
        budgetAmount: "100.00",
        diagnosticFee: "20.00",
      },
    } as never);

    await expect(
      decidirPresupuestoCliente("req-1", "client-1", "aceptar"),
    ).resolves.toEqual({ ok: true, decision: "aceptar" });

    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromStatus: "diagnosticada",
        toStatus: "aceptada",
        changedById: "client-1",
        reason: null,
      },
    });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", status: "diagnosticada" },
      data: { status: "aceptada", lastActivityAt: expect.any(Date) },
    });
    expect(tx.workLog.updateMany).toHaveBeenCalled();
  });

  it("registra la expiración con actor de sistema y motivo", async () => {
    tx.serviceRequest.findMany.mockResolvedValue([
      { id: "req-1", status: "diagnosticada" },
    ]);

    await expirarPresupuestosVencidos();

    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromStatus: "diagnosticada",
        toStatus: "expirada",
        changedById: null,
        reason: "Presupuesto vencido",
      },
    });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", status: "diagnosticada" },
      data: { status: "expirada", lastActivityAt: expect.any(Date) },
    });
  });

  it("solo registra historial de las filas que realmente expiraron", async () => {
    tx.serviceRequest.findMany.mockResolvedValue([
      { id: "req-1", status: "pendiente" },
      { id: "req-2", status: "diagnosticada" },
    ]);
    tx.quote.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expirarPresupuestosVencidos();

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-2", status: "diagnosticada" },
      data: { status: "expirada", lastActivityAt: expect.any(Date) },
    });
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-2",
        fromStatus: "diagnosticada",
        toStatus: "expirada",
        changedById: null,
        reason: "Presupuesto vencido",
      },
    });
  });
});
