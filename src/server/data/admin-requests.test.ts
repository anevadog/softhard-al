import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Los emails (5.2) se prueban en integración; aquí el encolado es un no-op.
vi.mock("@/server/data/emails", () => ({
  encolarPedidoConfirmadoEnTx: vi.fn().mockResolvedValue(true),
  encolarPresupuestoListoEnTx: vi.fn().mockResolvedValue(true),
  encolarReparacionListaEnTx: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    serviceRequest: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { crearPresupuesto, listarSolicitudesAdmin } from "@/server/data/admin-requests";

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

describe("listarSolicitudesAdmin", () => {
  it("cuenta en la consulta solo las faltas de repuesto sin atender", async () => {
    vi.mocked(prisma.serviceRequest.findMany).mockResolvedValue([
      {
        id: "req-1",
        createdAt: new Date("2026-10-26T10:00:00Z"),
        status: "en_reparacion",
        equipmentType: "portatil",
        brand: "HP",
        model: "440",
        client: { name: "Cliente Demo", email: "cliente@demo.local" },
        quote: null,
        _count: { notes: 2 },
      },
    ] as never);

    const [fila] = await listarSolicitudesAdmin();
    const args = vi.mocked(prisma.serviceRequest.findMany).mock.calls[0]?.[0];

    expect(args?.select?._count).toEqual({
      select: { notes: { where: { type: "falta_repuesto", resolvedAt: null } } },
    });
    expect(fila?.faltasRepuestoPendientes).toBe(2);
    expect(fila).not.toHaveProperty("_count");
  });

  it("el filtro de faltas de repuesto va en la consulta y se combina con el estado", async () => {
    vi.mocked(prisma.serviceRequest.findMany).mockClear();
    vi.mocked(prisma.serviceRequest.findMany).mockResolvedValue([]);

    await listarSolicitudesAdmin("en_reparacion", { soloFaltasRepuesto: true });

    expect(vi.mocked(prisma.serviceRequest.findMany).mock.calls[0]?.[0]?.where).toEqual({
      status: "en_reparacion",
      notes: { some: { type: "falta_repuesto", resolvedAt: null } },
    });
  });
});
