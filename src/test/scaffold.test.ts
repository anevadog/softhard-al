import { describe, expect, it } from "vitest";

import { formatEuros } from "@/lib/format";

describe("scaffold", () => {
  it("el runner de Vitest está operativo", () => {
    expect(true).toBe(true);
  });

  it("resuelve el alias @/* contra src/", () => {
    expect(typeof formatEuros).toBe("function");
  });
});

describe("formatEuros", () => {
  it("formatea con dos decimales y coma decimal", () => {
    expect(formatEuros(1234.5)).toContain("1234,50");
  });

  it("agrupa miles a partir de cinco cifras (convención es-ES)", () => {
    expect(formatEuros(12345.5)).toContain("12.345,50");
  });

  it("formatea el importe cero, caso límite de la regla del descuento", () => {
    expect(formatEuros(0)).toContain("0,00");
  });
});
