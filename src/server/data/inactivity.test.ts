import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    config: { findUnique: vi.fn() },
    serviceRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  listarDevueltasSinResponsable,
  listarMisReparacionesDescuidadas,
  listarReparacionesSinActividad,
  obtenerHorasInactividad,
} from "@/server/data/inactivity";

const findMany = vi.mocked(prisma.serviceRequest.findMany);
const count = vi.mocked(prisma.serviceRequest.count);
const LIMITE = new Date("2026-10-26T12:00:00Z");

type Args = { where: unknown; take?: number; orderBy?: unknown; select?: Record<string, unknown> };
const args = () => findMany.mock.calls[0]?.[0] as Args;

describe("consultas de inactividad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it("usa 48 h si no hay configuración", async () => {
    vi.mocked(prisma.config.findUnique).mockResolvedValue(null);
    await expect(obtenerHorasInactividad()).resolves.toBe(48);

    vi.mocked(prisma.config.findUnique).mockResolvedValue({ inactiveRequestHours: 24 } as never);
    await expect(obtenerHorasInactividad()).resolves.toBe(24);
  });

  it("el aviso del trabajador filtra por responsable, estados abiertos y plazo en la consulta", async () => {
    count.mockResolvedValue(25);

    const resultado = await listarMisReparacionesDescuidadas("worker-1", LIMITE);
    const where = {
      assigneeId: "worker-1",
      status: { in: ["aceptada", "en_reparacion", "esperando_repuesto"] },
      lastActivityAt: { lt: LIMITE },
    };

    expect(args().where).toEqual(where);
    expect(args().orderBy).toEqual({ lastActivityAt: "asc" });
    expect(args().take).toBe(20);
    expect(count).toHaveBeenCalledWith({ where });
    expect(resultado.total).toBe(25);
  });

  it("el panel vigila también las listas para entregar, con o sin responsable", async () => {
    await listarReparacionesSinActividad(LIMITE);

    expect(args().where).toEqual({
      status: { in: ["aceptada", "en_reparacion", "esperando_repuesto", "lista"] },
      lastActivityAt: { lt: LIMITE },
    });
  });

  it("las devueltas son no finales, sin responsable y con una devolución en el historial", async () => {
    findMany.mockResolvedValue([
      {
        id: "req-1",
        status: "en_reparacion",
        equipmentType: "portatil",
        brand: "HP",
        model: "440",
        lastActivityAt: LIMITE,
        assignee: null,
        assignmentHistory: [
          { createdAt: LIMITE, reason: "Falta la pieza", fromAssignee: { name: "QA A" } },
        ],
      },
    ] as never);
    count.mockResolvedValue(1);

    const resultado = await listarDevueltasSinResponsable();

    expect(args().where).toEqual({
      assigneeId: null,
      status: { notIn: ["entregada", "rechazada", "expirada"] },
      assignmentHistory: { some: { toAssigneeId: null } },
    });
    expect(resultado.elementos[0]?.devolucion).toEqual({
      createdAt: LIMITE,
      reason: "Falta la pieza",
      fromAssignee: { name: "QA A" },
    });
    expect(resultado.elementos[0]).not.toHaveProperty("assignmentHistory");
  });
});
