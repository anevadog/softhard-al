import { describe, expect, it } from "vitest";

import { esFaltaPendiente, ordenarNotas } from "@/lib/request-notes";

const fecha = (iso: string) => new Date(iso);

describe("esFaltaPendiente", () => {
  it("solo una falta de repuesto sin atender está pendiente", () => {
    expect(esFaltaPendiente({ type: "falta_repuesto", resolvedAt: null })).toBe(true);
    expect(
      esFaltaPendiente({ type: "falta_repuesto", resolvedAt: fecha("2026-10-26T10:00:00Z") }),
    ).toBe(false);
    expect(esFaltaPendiente({ type: "normal", resolvedAt: null })).toBe(false);
  });
});

describe("ordenarNotas", () => {
  it("pone primero las faltas pendientes y después el resto, las recientes arriba", () => {
    const notas = [
      { id: "normal-antigua", type: "normal" as const, resolvedAt: null, createdAt: fecha("2026-10-20T10:00:00Z") },
      { id: "falta-atendida", type: "falta_repuesto" as const, resolvedAt: fecha("2026-10-25T10:00:00Z"), createdAt: fecha("2026-10-24T10:00:00Z") },
      { id: "falta-antigua", type: "falta_repuesto" as const, resolvedAt: null, createdAt: fecha("2026-10-21T10:00:00Z") },
      { id: "normal-reciente", type: "normal" as const, resolvedAt: null, createdAt: fecha("2026-10-26T10:00:00Z") },
      { id: "falta-reciente", type: "falta_repuesto" as const, resolvedAt: null, createdAt: fecha("2026-10-23T10:00:00Z") },
    ];

    expect(ordenarNotas(notas).map((nota) => nota.id)).toEqual([
      "falta-reciente",
      "falta-antigua",
      "normal-reciente",
      "falta-atendida",
      "normal-antigua",
    ]);
  });

  it("no modifica el array original", () => {
    const notas = [
      { type: "normal" as const, resolvedAt: null, createdAt: fecha("2026-10-20T10:00:00Z") },
      { type: "falta_repuesto" as const, resolvedAt: null, createdAt: fecha("2026-10-19T10:00:00Z") },
    ];
    const copia = [...notas];

    ordenarNotas(notas);

    expect(notas).toEqual(copia);
  });
});
