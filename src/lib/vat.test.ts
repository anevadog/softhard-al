import { describe, expect, it } from "vitest";

import { desglosarTotal, sumarDesgloses } from "@/lib/vat";

describe("desglose de IVA B2C", () => {
  it("separa base e IVA de un PVP con IVA incluido", () => {
    expect(desglosarTotal(12100, 21)).toEqual({
      totalCentimos: 12100,
      baseCentimos: 10000,
      ivaCentimos: 2100,
    });
    expect(desglosarTotal(5990, 21)).toEqual({
      totalCentimos: 5990,
      baseCentimos: 4950,
      ivaCentimos: 1040,
    });
  });

  it("base + IVA = total siempre", () => {
    for (let total = -500; total <= 5000; total += 7) {
      const { baseCentimos, ivaCentimos } = desglosarTotal(total, 21);
      expect(baseCentimos + ivaCentimos).toBe(total);
    }
  });

  it("un PVP de 0,01 € tiene base 0,01 € e IVA 0", () => {
    expect(desglosarTotal(1, 21)).toEqual({ totalCentimos: 1, baseCentimos: 1, ivaCentimos: 0 });
  });

  it("redondea la mitad alejándose de cero, también en negativo (como ROUND de PostgreSQL)", () => {
    // Con el 21 % nunca sale una mitad exacta; con un tipo del 100 % la base
    // de un céntimo impar es x,5.
    expect(desglosarTotal(1, 100).baseCentimos).toBe(1);
    expect(desglosarTotal(-1, 100).baseCentimos).toBe(-1);
    expect(desglosarTotal(3, 100).baseCentimos).toBe(2);
    expect(desglosarTotal(-3, 100).baseCentimos).toBe(-2);
  });

  it("la rectificativa es el negativo exacto de la original para cualquier importe", () => {
    for (let total = 1; total <= 3000; total += 1) {
      const original = desglosarTotal(total, 21);
      const rectificativa = desglosarTotal(-total, 21);
      expect(rectificativa.baseCentimos + original.baseCentimos).toBe(0);
      expect(rectificativa.ivaCentimos + original.ivaCentimos).toBe(0);
    }
  });

  it("admite tipos con decimales", () => {
    const { baseCentimos, ivaCentimos } = desglosarTotal(1100, 10);
    expect([baseCentimos, ivaCentimos]).toEqual([1000, 100]);
  });

  it("los totales son la suma de las líneas", () => {
    expect(
      sumarDesgloses([desglosarTotal(12100, 21), desglosarTotal(-3000, 21)]),
    ).toEqual({ totalCentimos: 9100, baseCentimos: 7521, ivaCentimos: 1579 });
  });
});
