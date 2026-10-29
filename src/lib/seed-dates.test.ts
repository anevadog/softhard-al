import { describe, expect, it } from "vitest";

import { fechaHistorico, haceHoras, mesHistorico, sumarDias } from "@/lib/seed-dates";

// 29/10/2026 12:00 en Madrid (horario de verano, UTC+2).
const AHORA = new Date("2026-10-29T10:00:00Z");

describe("mesHistorico", () => {
  it("el mes 12 es el actual y el mes 1, el de hace 11 meses", () => {
    expect(mesHistorico(12, AHORA)).toMatchObject({ year: 2026, month: 10, dias: 31 });
    expect(mesHistorico(1, AHORA)).toMatchObject({ year: 2025, month: 11, dias: 30 });
    expect(mesHistorico(3, AHORA)).toMatchObject({ year: 2026, month: 1 });
  });

  it("los límites son el día 1 a las 00:00 en Madrid", () => {
    const enero = mesHistorico(3, AHORA);
    expect(enero.inicio.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(enero.fin.toISOString()).toBe("2026-01-31T23:00:00.000Z");
  });

  it("en enero, los meses anteriores son del año pasado", () => {
    const enEnero = new Date("2027-01-15T10:00:00Z");
    expect(mesHistorico(12, enEnero)).toMatchObject({ year: 2027, month: 1 });
    expect(mesHistorico(11, enEnero)).toMatchObject({ year: 2026, month: 12 });
    expect(mesHistorico(1, enEnero)).toMatchObject({ year: 2026, month: 2, dias: 28 });
  });

  it("rechaza meses fuera de 1…12", () => {
    expect(() => mesHistorico(0, AHORA)).toThrow(RangeError);
    expect(() => mesHistorico(13, AHORA)).toThrow(RangeError);
  });
});

describe("fechaHistorico", () => {
  it("usa día y hora de Madrid en los meses pasados, también con cambio de hora", () => {
    // Mes 2 = diciembre de 2025 (UTC+1); mes 8 = junio de 2026 (UTC+2).
    expect(fechaHistorico(2, 10, 9, AHORA).toISOString()).toBe("2025-12-10T08:00:00.000Z");
    expect(fechaHistorico(8, 10, 9, AHORA).toISOString()).toBe("2026-06-10T07:00:00.000Z");
  });

  it("recorta el día al último del mes", () => {
    // Mes 1 = noviembre de 2025, de 30 días.
    expect(fechaHistorico(1, 31, 12, AHORA).toISOString()).toBe("2025-11-30T11:00:00.000Z");
  });

  it("en el mes actual nunca cae en el futuro y conserva el orden", () => {
    const fechas = [
      fechaHistorico(12, 3, 10, AHORA),
      fechaHistorico(12, 15, 10, AHORA),
      fechaHistorico(12, 30, 18, AHORA),
      fechaHistorico(12, 31, 23, AHORA, 59),
    ];

    for (const fecha of fechas) {
      expect(fecha.getTime()).toBeLessThan(AHORA.getTime());
      expect(fecha.getTime()).toBeGreaterThanOrEqual(mesHistorico(12, AHORA).inicio.getTime());
    }
    expect([...fechas].sort((a, b) => a.getTime() - b.getTime())).toEqual(fechas);
  });

  it("el día 1 de madrugada todo el mes actual cabe antes de ahora", () => {
    // 01/11/2026 00:30 en Madrid (UTC+1).
    const madrugada = new Date("2026-10-31T23:30:00Z");
    const fecha = fechaHistorico(12, 28, 18, madrugada);

    expect(fecha.getTime()).toBeLessThan(madrugada.getTime());
    expect(fecha.getTime()).toBeGreaterThanOrEqual(new Date("2026-10-31T23:00:00Z").getTime());
  });
});

describe("haceHoras y sumarDias", () => {
  it("desplazan en horas y días", () => {
    expect(haceHoras(AHORA, 3).toISOString()).toBe("2026-10-29T07:00:00.000Z");
    expect(sumarDias(AHORA, -1.5).toISOString()).toBe("2026-10-27T22:00:00.000Z");
  });
});
