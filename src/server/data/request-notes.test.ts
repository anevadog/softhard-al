import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    requestNote: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  contarFaltasRepuestoPendientes,
  crearNotaStaff,
  crearNotaTrabajador,
  listarNotasReparacionTrabajador,
  marcarNotaAtendida,
} from "@/server/data/request-notes";

function crearTx() {
  return {
    serviceRequest: { updateMany: vi.fn() },
    requestNote: {
      create: vi.fn(),
      findUnique: vi.fn(),
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

describe("crear notas", () => {
  let tx: TxMock;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = crearTx();
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.requestNote.create.mockResolvedValue({} as never);
    configurarTransaccion(tx);
  });

  it("el trabajador deja una nota en su reparación abierta y marca actividad", async () => {
    await expect(
      crearNotaTrabajador({
        userId: "worker-1",
        requestId: "req-1",
        tipo: "falta_repuesto",
        texto: "  Falta la pantalla  ",
      }),
    ).resolves.toEqual({ ok: true, requestId: "req-1" });

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        assigneeId: "worker-1",
        status: { notIn: ["entregada", "rechazada", "expirada"] },
      },
      data: { lastActivityAt: expect.any(Date) },
    });
    expect(tx.requestNote.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        authorId: "worker-1",
        type: "falta_repuesto",
        body: "Falta la pantalla",
      },
    });
  });

  it("el trabajador no deja notas en reparaciones ajenas, inexistentes o cerradas", async () => {
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      crearNotaTrabajador({
        userId: "worker-1",
        requestId: "req-ajena",
        tipo: "normal",
        texto: "Hola",
      }),
    ).resolves.toEqual({ ok: false, motivo: "no-disponible" });
    expect(tx.requestNote.create).not.toHaveBeenCalled();
  });

  it("el staff deja notas en cualquier reparación existente", async () => {
    await expect(
      crearNotaStaff({ actorId: "staff-1", requestId: "req-1", tipo: "normal", texto: "Pieza pedida" }),
    ).resolves.toEqual({ ok: true, requestId: "req-1" });

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { lastActivityAt: expect.any(Date) },
    });

    tx.serviceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      crearNotaStaff({ actorId: "staff-1", requestId: "nada", tipo: "normal", texto: "x" }),
    ).resolves.toEqual({ ok: false, motivo: "no-existe" });
  });
});

describe("marcarNotaAtendida", () => {
  let tx: TxMock;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = crearTx();
    tx.requestNote.findUnique.mockResolvedValue({
      requestId: "req-1",
      type: "falta_repuesto",
      resolvedAt: null,
    } as never);
    tx.requestNote.updateMany.mockResolvedValue({ count: 1 });
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
    configurarTransaccion(tx);
  });

  it("marca la falta como atendida con quién y cuándo, y marca actividad", async () => {
    await expect(
      marcarNotaAtendida({ actorId: "staff-1", noteId: "n-1" }),
    ).resolves.toEqual({ ok: true, requestId: "req-1" });

    expect(tx.requestNote.updateMany).toHaveBeenCalledWith({
      where: { id: "n-1", type: "falta_repuesto", resolvedAt: null },
      data: { resolvedAt: expect.any(Date), resolvedById: "staff-1" },
    });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { lastActivityAt: expect.any(Date) },
    });
  });

  it("no atiende dos veces, ni aunque otro gane la carrera", async () => {
    tx.requestNote.findUnique.mockResolvedValue({
      requestId: "req-1",
      type: "falta_repuesto",
      resolvedAt: new Date(),
    } as never);

    await expect(
      marcarNotaAtendida({ actorId: "staff-1", noteId: "n-1" }),
    ).resolves.toEqual({ ok: false, motivo: "ya-atendida" });

    tx.requestNote.findUnique.mockResolvedValue({
      requestId: "req-1",
      type: "falta_repuesto",
      resolvedAt: null,
    } as never);
    tx.requestNote.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      marcarNotaAtendida({ actorId: "staff-1", noteId: "n-1" }),
    ).resolves.toEqual({ ok: false, motivo: "ya-atendida" });
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("una nota normal o inexistente no se marca", async () => {
    tx.requestNote.findUnique.mockResolvedValue({
      requestId: "req-1",
      type: "normal",
      resolvedAt: null,
    } as never);

    await expect(
      marcarNotaAtendida({ actorId: "staff-1", noteId: "n-1" }),
    ).resolves.toEqual({ ok: false, motivo: "no-es-falta" });

    tx.requestNote.findUnique.mockResolvedValue(null);

    await expect(
      marcarNotaAtendida({ actorId: "staff-1", noteId: "n-x" }),
    ).resolves.toEqual({ ok: false, motivo: "nota-no-existe" });
    expect(tx.requestNote.updateMany).not.toHaveBeenCalled();
  });
});

describe("consultas de notas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.requestNote.findMany).mockResolvedValue([]);
  });

  it("el trabajador solo ve notas de reparaciones suyas, con el filtro en la consulta", async () => {
    await listarNotasReparacionTrabajador("req-1", "worker-1");

    expect(prisma.requestNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestId: "req-1", request: { assigneeId: "worker-1" } },
      }),
    );
  });

  it("cuenta solo faltas de repuesto sin atender", async () => {
    vi.mocked(prisma.requestNote.count).mockResolvedValue(3);

    await expect(contarFaltasRepuestoPendientes()).resolves.toBe(3);
    expect(prisma.requestNote.count).toHaveBeenCalledWith({
      where: { type: "falta_repuesto", resolvedAt: null },
    });
  });
});
