import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    workLog: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { semanaDesdeClave } from "@/lib/work-logs";
import {
  listarFichajesDeReparaciones,
  listarFichajesSemana,
} from "@/server/data/reports";

const findMany = vi.mocked(prisma.workLog.findMany);
const semana = semanaDesdeClave("2026-10-19", new Date());
const where = () => (findMany.mock.calls[0]?.[0] as { where: unknown }).where;

describe("consultas de reportes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
  });

  it("filtra la semana del cambio de hora por inicio en Madrid", async () => {
    await listarFichajesSemana(semana);

    expect(where()).toEqual({
      startedAt: {
        gte: new Date("2026-10-18T22:00:00Z"),
        lt: new Date("2026-10-25T23:00:00Z"),
      },
    });
  });

  it("filtra por trabajador en la consulta cuando se indica", async () => {
    await listarFichajesSemana(semana, "worker-1");

    expect(where()).toEqual(expect.objectContaining({ userId: "worker-1" }));
  });

  it("el acumulado no consulta nada si no hay reparaciones", async () => {
    await expect(listarFichajesDeReparaciones([])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();

    await listarFichajesDeReparaciones(["r1", "r2"]);
    expect(where()).toEqual({ requestId: { in: ["r1", "r2"] } });
  });
});
