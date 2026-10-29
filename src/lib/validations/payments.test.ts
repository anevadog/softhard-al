import { describe, expect, it } from "vitest";

import { registrarCobroSchema } from "@/lib/validations/payments";

const BASE = {
  entidad: "solicitud",
  id: "req-1",
  importe: "90,00",
  metodo: "efectivo",
  nota: "",
};

describe("validación del registro de cobro", () => {
  it("acepta coma o punto y convierte la nota vacía en null", () => {
    expect(registrarCobroSchema.parse(BASE)).toEqual({
      entidad: "solicitud",
      id: "req-1",
      importe: 90,
      metodo: "efectivo",
      nota: null,
    });
    expect(registrarCobroSchema.parse({ ...BASE, importe: "12.5" }).importe).toBe(12.5);
  });

  it("rechaza importes 0, negativos o con más de dos decimales", () => {
    for (const importe of ["0", "0,00", "-5", "10,999", "abc", ""]) {
      expect(registrarCobroSchema.safeParse({ ...BASE, importe }).success).toBe(false);
    }
  });

  it("el staff no puede registrar a mano un pago con tarjeta online", () => {
    expect(
      registrarCobroSchema.safeParse({ ...BASE, metodo: "tarjeta_online" }).success,
    ).toBe(false);
    expect(registrarCobroSchema.safeParse({ ...BASE, metodo: "cheque" }).success).toBe(false);
  });

  it("limita la nota a 500 caracteres", () => {
    expect(
      registrarCobroSchema.safeParse({ ...BASE, nota: "x".repeat(501) }).success,
    ).toBe(false);
  });
});
