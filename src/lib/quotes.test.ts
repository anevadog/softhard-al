import { describe, expect, it } from "vitest";

import {
  calcularExpiracion,
  calcularImporteSiAcepta,
  calcularImporteSiRechaza,
  validarPresupuesto,
} from "@/lib/quotes";

describe("calcularImporteSiAcepta", () => {
  it("resta la tarifa de diagnóstico al presupuesto", () => {
    expect(calcularImporteSiAcepta(120.5, 30)).toBe(90.5);
  });

  it("devuelve 0 cuando el presupuesto es igual a la tarifa", () => {
    expect(calcularImporteSiAcepta(30, 30)).toBe(0);
  });

  it("no arrastra errores de coma flotante", () => {
    expect(calcularImporteSiAcepta(0.3, 0.1)).toBe(0.2);
    expect(calcularImporteSiAcepta(10.1, 3.03)).toBe(7.07);
  });

  it("mantiene el importe si la tarifa es 0", () => {
    expect(calcularImporteSiAcepta(99.99, 0)).toBe(99.99);
  });
});

describe("calcularImporteSiRechaza", () => {
  it("devuelve solo la tarifa de diagnóstico", () => {
    expect(calcularImporteSiRechaza(30)).toBe(30);
  });

  it("normaliza a dos decimales", () => {
    expect(calcularImporteSiRechaza(29.999)).toBe(30);
  });
});

describe("validarPresupuesto", () => {
  it("acepta un importe mayor que la tarifa", () => {
    expect(validarPresupuesto(120.5, 30)).toBeNull();
  });

  it("acepta un importe igual a la tarifa", () => {
    expect(validarPresupuesto(30, 30)).toBeNull();
  });

  it("rechaza un importe menor que la tarifa e informa del mínimo", () => {
    const error = validarPresupuesto(10, 30);

    expect(error).toContain("no puede ser inferior");
    expect(error).toContain("30,00");
  });

  it("rechaza importes de cero o negativos", () => {
    expect(validarPresupuesto(0, 30)).toBe("El importe debe ser mayor que 0.");
    expect(validarPresupuesto(-5, 30)).toBe("El importe debe ser mayor que 0.");
  });

  it("rechaza importes fuera del rango de la base de datos", () => {
    expect(validarPresupuesto(1_000_000, 30)).toContain("no puede superar");
  });

  it("rechaza valores no numéricos", () => {
    expect(validarPresupuesto(Number.NaN, 30)).toBe("El importe debe ser mayor que 0.");
  });
});

describe("calcularExpiracion", () => {
  it("suma los días de configuración a la fecha base", () => {
    const base = new Date(2026, 9, 22, 10, 0, 0);
    const expiracion = calcularExpiracion(base, 7);

    expect(expiracion.getFullYear()).toBe(2026);
    expect(expiracion.getMonth()).toBe(9);
    expect(expiracion.getDate()).toBe(29);
    expect(expiracion.getHours()).toBe(10);
  });

  it("no modifica la fecha original", () => {
    const base = new Date(2026, 9, 22, 10, 0, 0);
    const antes = base.getTime();

    calcularExpiracion(base, 7);

    expect(base.getTime()).toBe(antes);
  });

  it("cruza el cambio de año", () => {
    const expiracion = calcularExpiracion(new Date(2026, 11, 28, 9, 0, 0), 7);

    expect(expiracion.getFullYear()).toBe(2027);
    expect(expiracion.getMonth()).toBe(0);
    expect(expiracion.getDate()).toBe(4);
  });
});
