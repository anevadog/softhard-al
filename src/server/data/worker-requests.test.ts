import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    serviceRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  LIMITE_PARA_TOMAR,
  listarMisReparaciones,
  listarReparacionesParaTomar,
  obtenerReparacionTrabajador,
} from "@/server/data/worker-requests";

const findMany = vi.mocked(prisma.serviceRequest.findMany);
const findFirst = vi.mocked(prisma.serviceRequest.findFirst);

function argumentos<T>(mock: { mock: { calls: unknown[][] } }, llamada = 0): T {
  return mock.mock.calls[llamada]?.[0] as T;
}

type ArgsConsulta = {
  where: Record<string, unknown>;
  select: Record<string, unknown>;
  orderBy?: unknown;
  take?: number;
};

const FECHA = new Date("2026-10-21T09:00:00Z");

/** Campos que devuelve Prisma para el `select` base del detalle. */
function filaBase(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    status: "aceptada",
    equipmentType: "portatil",
    brand: "Lenovo",
    model: "T14",
    issue: "No enciende",
    modality: "domicilio",
    lastActivityAt: new Date("2026-10-20T10:00:00Z"),
    createdAt: new Date("2026-10-18T10:00:00Z"),
    timeSlot: "manana",
    preferredDate: null,
    ...overrides,
  };
}

/** Fila de la consulta de una reparación propia, con historiales y cliente. */
function filaPropia(overrides: Record<string, unknown> = {}) {
  return filaBase({
    status: "en_reparacion",
    client: { name: "Cliente Demo" },
    statusHistory: [
      {
        id: "sh-1",
        createdAt: FECHA,
        fromStatus: "aceptada",
        toStatus: "en_reparacion",
        reason: null,
        changedBy: { name: "Trabajador Demo" },
      },
    ],
    assignmentHistory: [
      {
        id: "ah-1",
        createdAt: FECHA,
        reason: null,
        fromAssignee: null,
        toAssignee: { name: "Trabajador Demo" },
        changedBy: { name: "Trabajador Demo" },
      },
    ],
    ...overrides,
  });
}

describe("consultas del panel del trabajador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue(null);
  });

  it("lista mis reparaciones filtrando por responsable en la propia consulta", async () => {
    await listarMisReparaciones("worker-1");

    const args = argumentos<ArgsConsulta>(findMany);

    expect(args.where).toEqual({
      assigneeId: "worker-1",
      status: { in: ["aceptada", "en_reparacion", "esperando_repuesto", "lista"] },
    });
    expect(args.orderBy).toEqual({ lastActivityAt: "asc" });
    expect(args.select).toMatchObject({ lastActivityAt: true });
  });

  it("lista para tomar solo aceptadas sin responsable y con tope", async () => {
    await listarReparacionesParaTomar();

    const args = argumentos<ArgsConsulta>(findMany);

    expect(args.where).toEqual({ status: "aceptada", assigneeId: null });
    expect(args.take).toBe(LIMITE_PARA_TOMAR);
  });

  it("las listas no seleccionan datos del cliente", async () => {
    await listarMisReparaciones("worker-1");
    await listarReparacionesParaTomar();

    for (const llamada of findMany.mock.calls) {
      const { select } = llamada[0] as ArgsConsulta;
      expect(select).not.toHaveProperty("client");
      expect(select).not.toHaveProperty("clientId");
    }
  });

  it("busca primero la reparación propia y después la libre, con el filtro en el where", async () => {
    await obtenerReparacionTrabajador("req-1", "worker-1");

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(argumentos<ArgsConsulta>(findFirst, 0).where).toEqual({
      id: "req-1",
      assigneeId: "worker-1",
    });
    expect(argumentos<ArgsConsulta>(findFirst, 1).where).toEqual({
      id: "req-1",
      status: "aceptada",
      assigneeId: null,
    });
  });

  it("el detalle nunca selecciona email ni teléfono", async () => {
    await obtenerReparacionTrabajador("req-1", "worker-1");

    const propia = argumentos<ArgsConsulta>(findFirst, 0).select;

    expect(propia.client).toEqual({ select: { name: true } });

    for (const llamada of findFirst.mock.calls) {
      const serializado = JSON.stringify((llamada[0] as ArgsConsulta).select);
      expect(serializado).not.toContain("email");
      expect(serializado).not.toContain("phone");
    }
  });

  it("la consulta de una reparación libre no lee historiales ni cliente", async () => {
    await obtenerReparacionTrabajador("req-1", "worker-1");

    const libre = argumentos<ArgsConsulta>(findFirst, 1).select;

    expect(libre).not.toHaveProperty("client");
    expect(libre).not.toHaveProperty("statusHistory");
    expect(libre).not.toHaveProperty("assignmentHistory");
    expect(libre).toMatchObject({ id: true, status: true, issue: true, timeSlot: true });
  });

  it("devuelve null para una reparación ajena o inexistente", async () => {
    await expect(
      obtenerReparacionTrabajador("req-ajena", "worker-1"),
    ).resolves.toBeNull();
  });

  it("una reparación propia devuelve los dos historiales y el nombre del cliente", async () => {
    findFirst.mockResolvedValueOnce(filaPropia() as never);

    const detalle = await obtenerReparacionTrabajador("req-1", "worker-1");

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(detalle?.esMia).toBe(true);

    if (!detalle?.esMia) {
      throw new Error("Se esperaba una reparación propia");
    }

    expect(detalle.clientName).toBe("Cliente Demo");
    expect(detalle.statusHistory).toHaveLength(1);
    expect(detalle.assignmentHistory).toHaveLength(1);
    expect(detalle).not.toHaveProperty("client");
  });

  it("una reparación libre no trae historiales, ni cliente, ni su nombre en ninguna parte", async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(filaBase() as never);

    const detalle = await obtenerReparacionTrabajador("req-1", "worker-1");

    expect(detalle?.esMia).toBe(false);
    expect(detalle).not.toHaveProperty("statusHistory");
    expect(detalle).not.toHaveProperty("assignmentHistory");
    expect(detalle).not.toHaveProperty("client");
    expect(detalle).not.toHaveProperty("clientName");
    expect(JSON.stringify(detalle)).not.toContain("Cliente Demo");
  });
});
