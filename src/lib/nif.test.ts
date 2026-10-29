import { describe, expect, it } from "vitest";

import { esNifValido, normalizarNif } from "@/lib/nif";

describe("NIF del cliente", () => {
  it("normaliza espacios, puntos, guiones y minúsculas", () => {
    expect(normalizarNif(" 12.345.678-z ")).toBe("12345678Z");
  });

  it("valida la letra de control del DNI", () => {
    expect(esNifValido("12345678Z")).toBe(true);
    expect(esNifValido("12345678A")).toBe(false);
    expect(esNifValido("1234567Z")).toBe(false);
  });

  it("valida la letra de control del NIE", () => {
    expect(esNifValido("X1234567L")).toBe(true);
    expect(esNifValido("Y1234567X")).toBe(true);
    expect(esNifValido("X1234567A")).toBe(false);
  });

  it("acepta un CIF con formato válido", () => {
    expect(esNifValido("B12345678")).toBe(true);
    expect(esNifValido("I12345678")).toBe(false);
  });
});
