import type { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  asignarSolicitudStaff,
  devolverSolicitudTrabajador,
  listarTrabajadoresAsignables,
  tomarSolicitudTrabajador,
} from "@/server/data/assignments";

function crearTx() {
  return {
    user: {
      findUnique: vi.fn(),
    },
    serviceRequest: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    serviceAssignmentHistory: {
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

describe("asignaciones de reparaciones", () => {
  let tx: TxMock;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = crearTx();
    tx.user.findUnique.mockResolvedValue({ role: "trabajador" } as never);
    tx.serviceRequest.findUnique.mockResolvedValue({
      status: "aceptada",
      assigneeId: null,
    } as never);
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.serviceAssignmentHistory.create.mockResolvedValue({} as never);
    tx.workLog.updateMany.mockResolvedValue({ count: 0 });
    configurarTransaccion(tx);
  });

  it("asigna una reparación sin responsable a un trabajador", async () => {
    await expect(
      asignarSolicitudStaff({
        requestId: "req-1",
        assigneeId: "worker-1",
        assigneeEsperadoId: null,
        actorId: "staff-1",
        motivo: "",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        assigneeId: null,
        status: { notIn: ["entregada", "rechazada", "expirada"] },
      },
      data: {
        assigneeId: "worker-1",
        lastActivityAt: expect.any(Date),
      },
    });
    expect(tx.workLog.updateMany).not.toHaveBeenCalled();
    expect(tx.serviceAssignmentHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromAssigneeId: null,
        toAssigneeId: "worker-1",
        changedById: "staff-1",
        reason: null,
      },
    });
  });

  it("reasigna y cierra el fichaje abierto del trabajador saliente", async () => {
    tx.serviceRequest.findUnique.mockResolvedValue({
      status: "en_reparacion",
      assigneeId: "worker-1",
    } as never);

    await expect(
      asignarSolicitudStaff({
        requestId: "req-1",
        assigneeId: "worker-2",
        assigneeEsperadoId: "worker-1",
        actorId: "staff-1",
        motivo: "  Vacaciones  ",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.workLog.updateMany).toHaveBeenCalledWith({
      where: {
        requestId: "req-1",
        endedAt: null,
        userId: "worker-1",
      },
      data: { endedAt: expect.any(Date) },
    });
    expect(tx.serviceAssignmentHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromAssigneeId: "worker-1",
        toAssigneeId: "worker-2",
        changedById: "staff-1",
        reason: "Vacaciones",
      },
    });
  });

  it("no asigna en estados finales", async () => {
    tx.serviceRequest.findUnique.mockResolvedValue({
      status: "entregada",
      assigneeId: null,
    } as never);

    await expect(
      asignarSolicitudStaff({
        requestId: "req-1",
        assigneeId: "worker-1",
        assigneeEsperadoId: null,
        actorId: "staff-1",
      }),
    ).resolves.toEqual({ ok: false, motivo: "estado-final" });

    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.serviceAssignmentHistory.create).not.toHaveBeenCalled();
  });

  it("solo permite asignar a usuarios con rol trabajador", async () => {
    tx.user.findUnique.mockResolvedValue({ role: "cliente" } as never);

    await expect(
      asignarSolicitudStaff({
        requestId: "req-1",
        assigneeId: "client-1",
        assigneeEsperadoId: null,
        actorId: "staff-1",
      }),
    ).resolves.toEqual({ ok: false, motivo: "trabajador-invalido" });

    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.serviceAssignmentHistory.create).not.toHaveBeenCalled();
  });

  it("detecta que el responsable cambió desde que se abrió el formulario", async () => {
    tx.serviceRequest.findUnique.mockResolvedValue({
      status: "aceptada",
      assigneeId: "worker-2",
    } as never);

    await expect(
      asignarSolicitudStaff({
        requestId: "req-1",
        assigneeId: "worker-1",
        assigneeEsperadoId: null,
        actorId: "staff-1",
      }),
    ).resolves.toEqual({ ok: false, motivo: "conflicto" });

    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("no crea historial si la actualización condicional pierde la carrera", async () => {
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      asignarSolicitudStaff({
        requestId: "req-1",
        assigneeId: "worker-1",
        assigneeEsperadoId: null,
        actorId: "staff-1",
      }),
    ).resolves.toEqual({ ok: false, motivo: "conflicto" });

    expect(tx.serviceAssignmentHistory.create).not.toHaveBeenCalled();
    expect(tx.workLog.updateMany).not.toHaveBeenCalled();
  });

  it("no reasigna al mismo trabajador", async () => {
    tx.serviceRequest.findUnique.mockResolvedValue({
      status: "aceptada",
      assigneeId: "worker-1",
    } as never);

    await expect(
      asignarSolicitudStaff({
        requestId: "req-1",
        assigneeId: "worker-1",
        assigneeEsperadoId: "worker-1",
        actorId: "staff-1",
      }),
    ).resolves.toEqual({ ok: false, motivo: "mismo-asignado" });

    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("toma una reparación aceptada y sin responsable", async () => {
    await expect(
      tomarSolicitudTrabajador({
        requestId: "req-1",
        actorId: "worker-1",
        actorRol: "trabajador",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        status: "aceptada",
        assigneeId: null,
      },
      data: {
        assigneeId: "worker-1",
        lastActivityAt: expect.any(Date),
      },
    });
    expect(tx.serviceAssignmentHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromAssigneeId: null,
        toAssigneeId: "worker-1",
        changedById: "worker-1",
        reason: null,
      },
    });
  });

  it("falla si otro trabajador tomó la reparación antes", async () => {
    tx.serviceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      tomarSolicitudTrabajador({
        requestId: "req-1",
        actorId: "worker-1",
        actorRol: "trabajador",
      }),
    ).resolves.toEqual({ ok: false, motivo: "no-disponible" });

    expect(tx.serviceAssignmentHistory.create).not.toHaveBeenCalled();
  });

  it("no permite que el staff tome una reparación como trabajador", async () => {
    await expect(
      tomarSolicitudTrabajador({
        requestId: "req-1",
        actorId: "staff-1",
        actorRol: "encargado",
      }),
    ).resolves.toEqual({ ok: false, motivo: "no-autorizado" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("devuelve la reparación, conserva el estado y cierra el fichaje", async () => {
    tx.serviceRequest.findUnique.mockResolvedValue({
      status: "en_reparacion",
      assigneeId: "worker-1",
    } as never);

    await expect(
      devolverSolicitudTrabajador({
        requestId: "req-1",
        actorId: "worker-1",
        actorRol: "trabajador",
        motivo: "Falta la pieza",
      }),
    ).resolves.toEqual({ ok: true });

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "req-1",
        assigneeId: "worker-1",
        status: { notIn: ["entregada", "rechazada", "expirada"] },
      },
      data: {
        assigneeId: null,
        lastActivityAt: expect.any(Date),
      },
    });
    expect(tx.workLog.updateMany).toHaveBeenCalledWith({
      where: {
        requestId: "req-1",
        endedAt: null,
        userId: "worker-1",
      },
      data: { endedAt: expect.any(Date) },
    });
    expect(tx.serviceAssignmentHistory.create).toHaveBeenCalledWith({
      data: {
        requestId: "req-1",
        fromAssigneeId: "worker-1",
        toAssigneeId: null,
        changedById: "worker-1",
        reason: "Falta la pieza",
      },
    });
  });

  it("bloquea la devolución en estados finales", async () => {
    tx.serviceRequest.findUnique.mockResolvedValue({
      status: "entregada",
      assigneeId: "worker-1",
    } as never);

    await expect(
      devolverSolicitudTrabajador({
        requestId: "req-1",
        actorId: "worker-1",
        actorRol: "trabajador",
        motivo: "Ya no puedo seguir",
      }),
    ).resolves.toEqual({ ok: false, motivo: "estado-final" });

    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.serviceAssignmentHistory.create).not.toHaveBeenCalled();
  });

  it("oculta reparaciones asignadas a otro trabajador", async () => {
    tx.serviceRequest.findUnique.mockResolvedValue({
      status: "en_reparacion",
      assigneeId: "worker-2",
    } as never);

    await expect(
      devolverSolicitudTrabajador({
        requestId: "req-1",
        actorId: "worker-1",
        actorRol: "trabajador",
        motivo: "No es mía",
      }),
    ).resolves.toEqual({ ok: false, motivo: "no-existe" });

    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("exige motivo antes de abrir la transacción", async () => {
    await expect(
      devolverSolicitudTrabajador({
        requestId: "req-1",
        actorId: "worker-1",
        actorRol: "trabajador",
        motivo: "   ",
      }),
    ).resolves.toEqual({ ok: false, motivo: "motivo-obligatorio" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("solo permite devolver al rol trabajador", async () => {
    await expect(
      devolverSolicitudTrabajador({
        requestId: "req-1",
        actorId: "staff-1",
        actorRol: "admin",
        motivo: "Motivo",
      }),
    ).resolves.toEqual({ ok: false, motivo: "no-autorizado" });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("listarTrabajadoresAsignables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve solo usuarios con rol trabajador ordenados por nombre", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "worker-1", name: "Ana", email: "ana@example.local" },
    ] as never);

    await expect(listarTrabajadoresAsignables()).resolves.toEqual([
      { id: "worker-1", name: "Ana", email: "ana@example.local" },
    ]);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: "trabajador" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
  });
});
