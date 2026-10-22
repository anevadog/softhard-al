import { describe, expect, it } from "vitest";

import { necesitaPresupuesto, puedeCambiarEstado } from "@/lib/service-status";

describe("necesitaPresupuesto", () => {
  it("solo exige presupuesto para aceptada y rechazada", () => {
    expect(necesitaPresupuesto("aceptada")).toBe(true);
    expect(necesitaPresupuesto("rechazada")).toBe(true);
    expect(necesitaPresupuesto("diagnosticada")).toBe(false);
    expect(necesitaPresupuesto("en_reparacion")).toBe(false);
  });
});

describe("puedeCambiarEstado", () => {
  it("permite pasar de pendiente a diagnosticada", () => {
    expect(puedeCambiarEstado("pendiente", "diagnosticada", false)).toBe(true);
  });

  it("no permite repetir el mismo estado", () => {
    expect(puedeCambiarEstado("pendiente", "pendiente", false)).toBe(false);
  });

  it("no permite aceptar sin presupuesto", () => {
    expect(puedeCambiarEstado("pendiente", "aceptada", false)).toBe(false);
  });

  it("permite aceptar cuando ya hay presupuesto", () => {
    expect(puedeCambiarEstado("diagnosticada", "aceptada", true)).toBe(true);
  });

  it("no permite rechazar sin presupuesto", () => {
    expect(puedeCambiarEstado("diagnosticada", "rechazada", false)).toBe(false);
  });

  it("permite corregir el estado hacia atrás", () => {
    expect(puedeCambiarEstado("entregada", "pendiente", false)).toBe(true);
  });

  it("permite marcar la entrega sin presupuesto previo", () => {
    expect(puedeCambiarEstado("en_reparacion", "entregada", false)).toBe(true);
  });
});
