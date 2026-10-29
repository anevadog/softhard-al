import { describe, expect, it } from "vitest";

import {
  escalaRedonda,
  ingresosPorMes,
  periodoDesdeParam,
  resumirIngresos,
  type FilaIngresos,
} from "@/lib/dashboard";

// 29/10/2026 12:00 en Madrid.
const AHORA = new Date("2026-10-29T10:00:00Z");

describe("periodoDesdeParam", () => {
  it("mes actual por defecto y con valores desconocidos", () => {
    for (const valor of [undefined, null, "", "semana", "MES-ACTUAL"]) {
      const periodo = periodoDesdeParam(valor, AHORA);
      expect(periodo.clave).toBe("mes-actual");
      expect(periodo.meses.map((m) => m.clave)).toEqual(["2026-10"]);
    }
  });

  it("los límites son medianoche en Madrid, con el cambio de hora de octubre", () => {
    const periodo = periodoDesdeParam("mes-actual", AHORA);
    // 1/10 00:00 (UTC+2) y 1/11 00:00 (UTC+1).
    expect(periodo.inicio.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(periodo.fin.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("mes anterior, últimos 12 meses y año natural", () => {
    expect(periodoDesdeParam("mes-anterior", AHORA).meses.map((m) => m.clave)).toEqual(["2026-09"]);

    const doce = periodoDesdeParam("12-meses", AHORA);
    expect(doce.meses).toHaveLength(12);
    expect(doce.meses[0]?.clave).toBe("2025-11");
    expect(doce.meses[11]?.clave).toBe("2026-10");

    const anio = periodoDesdeParam("anio", AHORA);
    expect(anio.meses.map((m) => m.clave)).toEqual(
      ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((m) => `2026-${m}`),
    );
    expect(anio.inicio.toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  it("en enero, el mes anterior es diciembre del año pasado", () => {
    const enero = new Date("2027-01-10T10:00:00Z");
    expect(periodoDesdeParam("mes-anterior", enero).meses.map((m) => m.clave)).toEqual(["2026-12"]);
    expect(periodoDesdeParam("anio", enero).meses.map((m) => m.clave)).toEqual(["2027-01"]);
  });
});

const filas: FilaIngresos[] = [
  { mes: "2026-09", concept: "venta", series: "FAC", totalCentimos: 10_000, facturas: 2 },
  { mes: "2026-09", concept: "venta", series: "RECT", totalCentimos: -4_000, facturas: 1 },
  { mes: "2026-09", concept: "reparacion", series: "MIG", totalCentimos: 9_000, facturas: 1 },
  { mes: "2026-10", concept: "diagnostico", series: "FAC", totalCentimos: 3_000, facturas: 1 },
  { mes: "2026-10", concept: "reparacion", series: "RECT", totalCentimos: -9_000, facturas: 1 },
];

describe("resumirIngresos", () => {
  it("cada concepto es neto de sus rectificativas y el rectificado va aparte", () => {
    expect(resumirIngresos(filas)).toEqual({
      netoCentimos: 9_000,
      ventasCentimos: 6_000,
      reparacionesCentimos: 0,
      diagnosticosCentimos: 3_000,
      rectificadoCentimos: -13_000,
      facturasPorSerie: { FAC: 3, RECT: 2, MIG: 1 },
      facturas: 6,
    });
  });

  it("sin filas, todo a 0", () => {
    expect(resumirIngresos([])).toMatchObject({ netoCentimos: 0, facturas: 0 });
  });
});

describe("ingresosPorMes", () => {
  it("rellena los meses sin facturas y admite netos negativos", () => {
    const meses = periodoDesdeParam("12-meses", AHORA).meses.slice(-3);
    const porMes = ingresosPorMes(filas, meses);

    expect(porMes.map((m) => [m.mes.clave, m.ventasCentimos, m.tallerCentimos, m.netoCentimos])).toEqual([
      ["2026-08", 0, 0, 0],
      ["2026-09", 6_000, 9_000, 15_000],
      ["2026-10", 0, -6_000, -6_000],
    ]);
  });
});

describe("escalaRedonda", () => {
  it("marcas redondas que cubren el máximo desde 0", () => {
    expect(escalaRedonda([12_345, 80_000])).toEqual({
      min: 0,
      max: 80_000,
      paso: 20_000,
      marcas: [0, 20_000, 40_000, 60_000, 80_000],
    });
  });

  it("incluye los negativos por debajo del 0", () => {
    const escala = escalaRedonda([-6_000, 15_000]);
    expect(escala.min).toBeLessThanOrEqual(-6_000);
    expect(escala.max).toBeGreaterThanOrEqual(15_000);
    expect(escala.marcas).toContain(0);
    expect(escala.marcas.every((m) => m % escala.paso === 0)).toBe(true);
  });

  it("con todo a 0 va de 0 a 100 €", () => {
    const escala = escalaRedonda([0, 0]);
    expect(escala.min).toBe(0);
    expect(escala.max).toBe(10_000);
    expect(escala.marcas[0]).toBe(0);
  });

  it("sin valores también devuelve una escala válida", () => {
    expect(escalaRedonda([]).max).toBe(10_000);
  });
});
