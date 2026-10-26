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

function argumentos<T>(mock: { mock: { calls: unknown[][] } }): T {
  return mock.mock.calls[0]?.[0] as T;
}

type ArgsConsulta = {
  where: Record<string, unknown>;
  select: Record<string, unknown>;
  orderBy?: unknown;
  take?: number;
};

function filaDetalle(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    status: "en_reparacion",
    equipmentType: "portatil",
    brand: "Lenovo",
    model: "T14",
    issue: "No enciende",
    modality: "domicilio",
    lastActivityAt: new Date("2026-10-20T10:00:00Z"),
    createdAt: new Date("2026-10-18T10:00:00Z"),
    timeSlot: "manana",
    preferredDate: null,
    assigneeId: "worker-1",
    client: { name: "Cliente Demo" },
    statusHistory: [],
    assignmentHistory: [],
    ...overrides,
  };
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

  it("el detalle restringe a las suyas o aceptadas sin responsable en el where", async () => {
    await obtenerReparacionTrabajador("req-1", "worker-1");

    const args = argumentos<ArgsConsulta>(findFirst);

    expect(args.where).toEqual({
      id: "req-1",
      OR: [
        { assigneeId: "worker-1" },
        { status: "aceptada", assigneeId: null },
      ],
    });
  });

  it("el detalle nunca selecciona email ni teléfono", async () => {
    await obtenerReparacionTrabajador("req-1", "worker-1");

    const { select } = argumentos<ArgsConsulta>(findFirst);
    const serializado = JSON.stringify(select);

    expect(select.client).toEqual({ select: { name: true } });
    expect(serializado).not.toContain("email");
    expect(serializado).not.toContain("phone");
  });

  it("devuelve null para una reparación ajena o inexistente", async () => {
    await expect(
      obtenerReparacionTrabajador("req-ajena", "worker-1"),
    ).resolves.toBeNull();
  });

  it("marca como suya la reparación asignada y muestra el nombre del cliente", async () => {
    findFirst.mockResolvedValue(filaDetalle() as never);

    const detalle = await obtenerReparacionTrabajador("req-1", "worker-1");

    expect(detalle?.esMia).toBe(true);
    expect(detalle?.clientName).toBe("Cliente Demo");
    expect(detalle).not.toHaveProperty("assigneeId");
    expect(detalle).not.toHaveProperty("client");
  });

  it("una aceptada sin responsable no es suya y oculta el cliente", async () => {
    findFirst.mockResolvedValue(
      filaDetalle({ status: "aceptada", assigneeId: null }) as never,
    );

    const detalle = await obtenerReparacionTrabajador("req-1", "worker-1");

    expect(detalle?.esMia).toBe(false);
    expect(detalle?.clientName).toBeNull();
  });
});
