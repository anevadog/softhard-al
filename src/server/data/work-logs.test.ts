import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    config: { findUnique: vi.fn() },
    workLog: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { semanaDesdeClave } from "@/lib/work-logs";
import {
  cerrarFichajeStaff,
  cerrarFichajesAbiertosEnTx,
  corregirFichajeStaff,
  ficharEntradaGeneral,
  ficharEntradaReparacion,
  ficharSalida,
  listarFichajesReparacionTrabajador,
  listarMisFichajesSemana,
  obtenerHorasFichajeAbierto,
} from "@/server/data/work-logs";

function crearTx() {
  return {
    workLog: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    serviceRequest: {
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

function errorUnico() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

const INICIO = new Date("2026-10-20T06:00:00Z");
const FIN = new Date("2026-10-20T12:30:00Z");

describe("cerrarFichajesAbiertosEnTx", () => {
  it("cierra los fichajes abiertos de la reparación y devuelve cuántos", async () => {
    const tx = crearTx();
    const endedAt = new Date("2026-10-20T10:00:00Z");
    tx.workLog.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      cerrarFichajesAbiertosEnTx(tx as unknown as Prisma.TransactionClient, {
        requestId: "req-1",
        endedAt,
      }),
    ).resolves.toBe(2);

    expect(tx.workLog.updateMany).toHaveBeenCalledWith({
      where: { requestId: "req-1", endedAt: null },
      data: { endedAt },
    });
  });

  it("puede limitarse al fichaje de un trabajador", async () => {
    const tx = crearTx();
    tx.workLog.updateMany.mockResolvedValue({ count: 0 });

    await cerrarFichajesAbiertosEnTx(tx as unknown as Prisma.TransactionClient, {
      requestId: "req-1",
      userId: "worker-1",
    });

    expect(tx.workLog.updateMany).toHaveBeenCalledWith({
      where: { requestId: "req-1", endedAt: null, userId: "worker-1" },
      data: { endedAt: expect.any(Date) },
    });
  });
});

describe("fichaje del trabajador", () => {
  let tx: TxMock;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = crearTx();
    tx.workLog.findFirst.mockResolvedValue(null);
    tx.workLog.updateMany.mockResolvedValue({ count: 1 });
    tx.workLog.create.mockResolvedValue({} as never);
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
    configurarTransaccion(tx);
  });

  it("ficha entrada en una reparación propia en reparación y marca actividad", async () => {
    await expect(
      ficharEntradaReparacion({ userId: "worker-1", requestId: "req-1" }),
    ).resolves.toEqual({ ok: true, requestId: "req-1" });

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", assigneeId: "worker-1", status: "en_reparacion" },
      data: { lastActivityAt: expect.any(Date) },
    });
    expect(tx.workLog.create).toHaveBeenCalledWith({
      data: { userId: "worker-1", requestId: "req-1", startedAt: expect.any(Date) },
    });
  });

  it("no ficha en una reparación ajena, inexistente o fuera de en_reparacion", async () => {
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      ficharEntradaReparacion({ userId: "worker-1", requestId: "req-ajena" }),
    ).resolves.toEqual({ ok: false, motivo: "reparacion-no-disponible" });
    expect(tx.workLog.create).not.toHaveBeenCalled();
  });

  it("rechaza la entrada si ya tiene un fichaje abierto", async () => {
    tx.workLog.findFirst.mockResolvedValue({ id: "wl-abierto" } as never);

    await expect(
      ficharEntradaReparacion({ userId: "worker-1", requestId: "req-1" }),
    ).resolves.toEqual({ ok: false, motivo: "ya-abierto" });
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("traduce la violación del índice único (doble clic) a ya-abierto", async () => {
    tx.workLog.create.mockRejectedValue(errorUnico());

    await expect(
      ficharEntradaReparacion({ userId: "worker-1", requestId: "req-1" }),
    ).resolves.toEqual({ ok: false, motivo: "ya-abierto" });
  });

  it("propaga errores que no son del índice único", async () => {
    tx.workLog.create.mockRejectedValue(new Error("caída de BD"));

    await expect(
      ficharEntradaReparacion({ userId: "worker-1", requestId: "req-1" }),
    ).rejects.toThrow("caída de BD");
  });

  it("ficha horas generales con nota y sin reparación", async () => {
    vi.mocked(prisma.workLog.create).mockResolvedValue({} as never);

    await expect(
      ficharEntradaGeneral({ userId: "worker-1", nota: "  Inventario  " }),
    ).resolves.toEqual({ ok: true, requestId: null });
    expect(prisma.workLog.create).toHaveBeenCalledWith({
      data: {
        userId: "worker-1",
        requestId: null,
        note: "Inventario",
        startedAt: expect.any(Date),
      },
    });
  });

  it("exige nota en horas generales y detecta el doble fichaje", async () => {
    await expect(
      ficharEntradaGeneral({ userId: "worker-1", nota: "  " }),
    ).resolves.toEqual({ ok: false, motivo: "nota-obligatoria" });

    vi.mocked(prisma.workLog.create).mockRejectedValue(errorUnico());

    await expect(
      ficharEntradaGeneral({ userId: "worker-1", nota: "Inventario" }),
    ).resolves.toEqual({ ok: false, motivo: "ya-abierto" });
  });

  it("ficha la salida de su fichaje y marca actividad en la reparación", async () => {
    tx.workLog.findFirst.mockResolvedValue({ requestId: "req-1", endedAt: null } as never);

    await expect(
      ficharSalida({ userId: "worker-1", workLogId: "wl-1" }),
    ).resolves.toEqual({ ok: true, requestId: "req-1" });

    expect(tx.workLog.findFirst).toHaveBeenCalledWith({
      where: { id: "wl-1", userId: "worker-1" },
      select: { requestId: true, endedAt: true },
    });
    expect(tx.workLog.updateMany).toHaveBeenCalledWith({
      where: { id: "wl-1", userId: "worker-1", endedAt: null },
      data: { endedAt: expect.any(Date) },
    });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { lastActivityAt: expect.any(Date) },
    });
  });

  it("no cierra el fichaje de otro trabajador", async () => {
    tx.workLog.findFirst.mockResolvedValue(null);

    await expect(
      ficharSalida({ userId: "worker-1", workLogId: "wl-ajeno" }),
    ).resolves.toEqual({ ok: false, motivo: "no-existe" });
    expect(tx.workLog.updateMany).not.toHaveBeenCalled();
  });

  it("avisa si el fichaje ya estaba cerrado o se cerró mientras tanto", async () => {
    tx.workLog.findFirst.mockResolvedValue({ requestId: null, endedAt: FIN } as never);

    await expect(
      ficharSalida({ userId: "worker-1", workLogId: "wl-1" }),
    ).resolves.toEqual({ ok: false, motivo: "no-abierto" });

    tx.workLog.findFirst.mockResolvedValue({ requestId: null, endedAt: null } as never);
    tx.workLog.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      ficharSalida({ userId: "worker-1", workLogId: "wl-1" }),
    ).resolves.toEqual({ ok: false, motivo: "no-abierto" });
  });
});

describe("cierre y corrección del staff", () => {
  let tx: TxMock;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = crearTx();
    tx.workLog.findUnique.mockResolvedValue({ requestId: "req-1", endedAt: null } as never);
    tx.workLog.updateMany.mockResolvedValue({ count: 1 });
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
    configurarTransaccion(tx);
  });

  it("cierra un fichaje abierto dejando constancia del editor", async () => {
    await expect(
      cerrarFichajeStaff({ actorId: "staff-1", workLogId: "wl-1" }),
    ).resolves.toEqual({ ok: true, requestId: "req-1" });

    expect(tx.workLog.updateMany).toHaveBeenCalledWith({
      where: { id: "wl-1", endedAt: null },
      data: {
        endedAt: expect.any(Date),
        editedById: "staff-1",
        editedAt: expect.any(Date),
      },
    });
  });

  it("no cierra dos veces", async () => {
    tx.workLog.findUnique.mockResolvedValue({ requestId: "req-1", endedAt: FIN } as never);

    await expect(
      cerrarFichajeStaff({ actorId: "staff-1", workLogId: "wl-1" }),
    ).resolves.toEqual({ ok: false, motivo: "no-abierto" });
    expect(tx.workLog.updateMany).not.toHaveBeenCalled();
  });

  it("corrige entrada, salida y nota de un fichaje cerrado", async () => {
    tx.workLog.findUnique.mockResolvedValue({ requestId: "req-1", endedAt: FIN } as never);

    await expect(
      corregirFichajeStaff({
        actorId: "staff-1",
        workLogId: "wl-1",
        inicio: INICIO,
        fin: FIN,
        nota: "  Olvidó fichar la salida  ",
      }),
    ).resolves.toEqual({ ok: true, requestId: "req-1" });

    expect(tx.workLog.updateMany).toHaveBeenCalledWith({
      where: { id: "wl-1", endedAt: { not: null } },
      data: {
        startedAt: INICIO,
        endedAt: FIN,
        note: "Olvidó fichar la salida",
        editedById: "staff-1",
        editedAt: expect.any(Date),
      },
    });
  });

  it("corrige la entrada de un fichaje abierto sin cerrarlo", async () => {
    await corregirFichajeStaff({
      actorId: "staff-1",
      workLogId: "wl-1",
      inicio: INICIO,
      fin: null,
      nota: "",
    });

    const llamada = tx.workLog.updateMany.mock.calls[0]?.[0] as {
      where: unknown;
      data: Record<string, unknown>;
    };

    expect(llamada.where).toEqual({ id: "wl-1", endedAt: null });
    expect(llamada.data).not.toHaveProperty("endedAt");
    expect(llamada.data.note).toBeNull();
  });

  it("no reabre un fichaje cerrado ni cierra uno abierto", async () => {
    await expect(
      corregirFichajeStaff({ actorId: "s", workLogId: "wl-1", inicio: INICIO, fin: FIN, nota: "" }),
    ).resolves.toEqual({ ok: false, motivo: "cierre-aparte" });

    tx.workLog.findUnique.mockResolvedValue({ requestId: "req-1", endedAt: FIN } as never);

    await expect(
      corregirFichajeStaff({ actorId: "s", workLogId: "wl-1", inicio: INICIO, fin: null, nota: "" }),
    ).resolves.toEqual({ ok: false, motivo: "no-reabrir" });
    expect(tx.workLog.updateMany).not.toHaveBeenCalled();
  });

  it("exige nota en horas generales y rechaza una salida anterior a la entrada", async () => {
    tx.workLog.findUnique.mockResolvedValue({ requestId: null, endedAt: FIN } as never);

    await expect(
      corregirFichajeStaff({ actorId: "s", workLogId: "wl-1", inicio: INICIO, fin: FIN, nota: " " }),
    ).resolves.toEqual({ ok: false, motivo: "nota-obligatoria" });

    await expect(
      corregirFichajeStaff({ actorId: "s", workLogId: "wl-1", inicio: FIN, fin: INICIO, nota: "x" }),
    ).resolves.toEqual({ ok: false, motivo: "salida-anterior" });
  });

  it("informa de un conflicto si el fichaje cambió mientras tanto", async () => {
    tx.workLog.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      corregirFichajeStaff({ actorId: "s", workLogId: "wl-1", inicio: INICIO, fin: null, nota: "" }),
    ).resolves.toEqual({ ok: false, motivo: "conflicto" });
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
  });
});

describe("consultas de fichajes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.workLog.findMany).mockResolvedValue([]);
  });

  it("los fichajes de una reparación solo salen si es del trabajador", async () => {
    await listarFichajesReparacionTrabajador("req-1", "worker-1");

    expect(prisma.workLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestId: "req-1", request: { assigneeId: "worker-1" } },
      }),
    );
  });

  it("la semana filtra por inicio dentro de [lunes, lunes siguiente) en Madrid", async () => {
    const semana = semanaDesdeClave("2026-10-26", new Date());

    await listarMisFichajesSemana("worker-1", semana);

    expect(prisma.workLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "worker-1",
          startedAt: {
            gte: new Date("2026-10-25T23:00:00Z"),
            lt: new Date("2026-11-01T23:00:00Z"),
          },
        },
      }),
    );
  });

  it("usa 8 horas de aviso si no hay configuración", async () => {
    vi.mocked(prisma.config.findUnique).mockResolvedValue(null);
    await expect(obtenerHorasFichajeAbierto()).resolves.toBe(8);

    vi.mocked(prisma.config.findUnique).mockResolvedValue({ openWorkLogHours: 10 } as never);
    await expect(obtenerHorasFichajeAbierto()).resolves.toBe(10);
  });
});
