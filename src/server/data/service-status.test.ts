import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    serviceRequest: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { cambiarEstadoSolicitud } from "@/server/data/service-status";

function crearTx() {
  return {
    serviceRequest: {
      updateMany: vi.fn(),
    },
    serviceStatusHistory: {
      create: vi.fn(),
    },
    workLog: {
      updateMany: vi.fn(),
    },
    quote: {
      update: vi.fn(),
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

function configurarSolicitud(
  overrides: Partial<{
    status: string;
    assigneeId: string | null;
    quote: { budgetAmount: string; diagnosticFee: string } | null;
  }> = {},
) {
  vi.mocked(prisma.serviceRequest.findUnique).mockResolvedValue({
    status: "aceptada",
    assigneeId: "worker-1",
    quote: null,
    ...overrides,
  } as never);
}

describe("cambiarEstadoSolicitud", () => {
  let tx: TxMock;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = crearTx();
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.serviceStatusHistory.create.mockResolvedValue({} as never);
    tx.workLog.updateMany.mockResolvedValue({ count: 0 });
    tx.quote.update.mockResolvedValue({} as never);
    configurarTransaccion(tx);
  });

  it("cambia el estado, actualiza lastActivity y crea historial", async () => {
    configurarSolicitud();

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "aceptada",
        estadoNuevo: "en_reparacion",
        actorId: "worker-1",
        rol: "trabajador",
        motivo: null,
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        status: "aceptada",
        assigneeId: "worker-1",
      },
      data: {
        status: "en_reparacion",
        lastActivityAt: expect.any(Date),
      },
    });
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromStatus: "aceptada",
        toStatus: "en_reparacion",
        changedById: "worker-1",
        reason: null,
      },
    });
    expect(tx.workLog.updateMany).not.toHaveBeenCalled();
  });

  it("cierra los fichajes abiertos cuando el estado nuevo no es en_reparacion", async () => {
    configurarSolicitud({ status: "en_reparacion" });

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "en_reparacion",
        estadoNuevo: "lista",
        actorId: "worker-1",
        rol: "trabajador",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.workLog.updateMany).toHaveBeenCalledWith({
      where: { requestId: "req-1", endedAt: null },
      data: { endedAt: expect.any(Date) },
    });
  });

  it("también cierra fichajes en una corrección del staff hacia atrás", async () => {
    configurarSolicitud({ status: "entregada", assigneeId: null });

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "entregada",
        estadoNuevo: "pendiente",
        actorId: "staff-1",
        rol: "encargado",
        motivo: "Error de entrega",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.workLog.updateMany).toHaveBeenCalled();
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromStatus: "entregada",
        toStatus: "pendiente",
        changedById: "staff-1",
        reason: "Error de entrega",
      },
    });
  });

  it("no escribe historial si la actualización condicional pierde la carrera", async () => {
    configurarSolicitud();
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "aceptada",
        estadoNuevo: "en_reparacion",
        actorId: "worker-1",
        rol: "trabajador",
      }),
    ).resolves.toEqual({ ok: false, motivo: "conflicto" });

    expect(tx.serviceStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.workLog.updateMany).not.toHaveBeenCalled();
  });

  it("oculta solicitudes no asignadas al trabajador", async () => {
    configurarSolicitud({ assigneeId: "worker-2" });

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "aceptada",
        estadoNuevo: "en_reparacion",
        actorId: "worker-1",
        rol: "trabajador",
      }),
    ).resolves.toEqual({ ok: false, motivo: "no-existe" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("exige motivo en una corrección antes de abrir la transacción", async () => {
    configurarSolicitud({ status: "entregada", assigneeId: null });

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "entregada",
        estadoNuevo: "pendiente",
        actorId: "staff-1",
        rol: "encargado",
        motivo: "   ",
      }),
    ).resolves.toEqual({ ok: false, motivo: "motivo-obligatorio" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza el cambio si el estado esperado ya no coincide", async () => {
    configurarSolicitud({ status: "lista" });

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "aceptada",
        estadoNuevo: "en_reparacion",
        actorId: "worker-1",
        rol: "trabajador",
      }),
    ).resolves.toEqual({ ok: false, motivo: "conflicto" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("actualiza el presupuesto al corregir a aceptada", async () => {
    configurarSolicitud({
      status: "diagnosticada",
      assigneeId: null,
      quote: { budgetAmount: "100.00", diagnosticFee: "20.00" },
    });

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "diagnosticada",
        estadoNuevo: "aceptada",
        actorId: "staff-1",
        rol: "encargado",
        motivo: "El cliente confirma por teléfono",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.quote.update).toHaveBeenCalledWith({
      where: { requestId: "req-1" },
      data: {
        status: "aceptado",
        decidedAt: expect.any(Date),
        finalAmount: "80.00",
      },
    });
  });

  it("no permite al trabajador marcar entregada", async () => {
    configurarSolicitud({ status: "lista" });

    await expect(
      cambiarEstadoSolicitud({
        requestId: "req-1",
        estadoEsperado: "lista",
        estadoNuevo: "entregada",
        actorId: "worker-1",
        rol: "trabajador",
      }),
    ).resolves.toEqual({ ok: false, motivo: "transicion-invalida" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
