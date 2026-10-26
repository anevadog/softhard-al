import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { crearPresupuesto } from "@/server/data/admin-requests";

function crearTx() {
  return {
    serviceRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    quote: {
      create: vi.fn(),
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

const DATOS = {
  requestId: "req-1",
  budgetAmount: 100,
  diagnosticFee: 20,
  finalAmount: 80,
  expiresAt: new Date("2026-11-02T10:00:00.000Z"),
  userId: "staff-1",
};

describe("crearPresupuesto", () => {
  let tx: TxMock;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = crearTx();
    tx.serviceRequest.findUnique.mockResolvedValue({
      id: "req-1",
      status: "pendiente",
      quote: null,
    } as never);
    tx.quote.create.mockResolvedValue({ id: "quote-1" } as never);
    tx.serviceRequest.update.mockResolvedValue({} as never);
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.serviceStatusHistory.create.mockResolvedValue({} as never);
    tx.workLog.updateMany.mockResolvedValue({ count: 0 });
    configurarTransaccion(tx);
  });

  it("crea el presupuesto y registra la transición del staff", async () => {
    await expect(crearPresupuesto(DATOS)).resolves.toEqual({
      ok: true,
      quoteId: "quote-1",
    });

    expect(tx.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { expiresAt: DATOS.expiresAt },
    });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", status: "pendiente" },
      data: { status: "diagnosticada", lastActivityAt: expect.any(Date) },
    });
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromStatus: "pendiente",
        toStatus: "diagnosticada",
        changedById: "staff-1",
        reason: "Presupuesto creado",
      },
    });
  });

  it("no duplica historial si la solicitud ya estaba diagnosticada", async () => {
    tx.serviceRequest.findUnique.mockResolvedValue({
      id: "req-1",
      status: "diagnosticada",
      quote: null,
    } as never);

    await expect(crearPresupuesto(DATOS)).resolves.toEqual({
      ok: true,
      quoteId: "quote-1",
    });

    expect(tx.serviceStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { expiresAt: DATOS.expiresAt },
    });
    expect(tx.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { lastActivityAt: expect.any(Date) },
    });
  });
});
