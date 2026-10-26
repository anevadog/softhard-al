import { describe, expect, it } from "vitest";

import {
  desplazarSemana,
  excedeHorasAbierto,
  formatearDuracion,
  inputMadridDesdeInstante,
  instanteDesdeHoraMadrid,
  instanteDesdeInputMadrid,
  minutosFichaje,
  minutosPorClave,
  semanaDe,
  semanaDesdeClave,
  totalMinutos,
} from "@/lib/work-logs";

const utc = (iso: string) => new Date(iso);

describe("duración de fichajes", () => {
  const ahora = utc("2026-10-26T12:00:00Z");

  it("cuenta minutos completos de un fichaje cerrado", () => {
    expect(
      minutosFichaje(
        { startedAt: utc("2026-10-26T08:00:00Z"), endedAt: utc("2026-10-26T09:30:59Z") },
        ahora,
      ),
    ).toBe(90);
  });

  it("un fichaje abierto cuenta hasta ahora", () => {
    expect(
      minutosFichaje({ startedAt: utc("2026-10-26T10:15:00Z"), endedAt: null }, ahora),
    ).toBe(105);
  });

  it("nunca devuelve minutos negativos", () => {
    expect(
      minutosFichaje({ startedAt: utc("2026-10-26T13:00:00Z"), endedAt: null }, ahora),
    ).toBe(0);
  });

  it("suma el total y agrupa por clave en orden de aparición", () => {
    const fichajes = [
      { startedAt: utc("2026-10-26T08:00:00Z"), endedAt: utc("2026-10-26T09:00:00Z"), k: "b" },
      { startedAt: utc("2026-10-26T09:00:00Z"), endedAt: utc("2026-10-26T09:30:00Z"), k: "a" },
      { startedAt: utc("2026-10-26T10:00:00Z"), endedAt: utc("2026-10-26T10:15:00Z"), k: "b" },
    ];

    expect(totalMinutos(fichajes, ahora)).toBe(105);
    expect(minutosPorClave(fichajes, (f) => f.k, ahora)).toEqual([
      { clave: "b", minutos: 75 },
      { clave: "a", minutos: 30 },
    ]);
  });

  it("formatea la duración en horas y minutos", () => {
    expect(formatearDuracion(0)).toBe("0 min");
    expect(formatearDuracion(45)).toBe("45 min");
    expect(formatearDuracion(120)).toBe("2 h");
    expect(formatearDuracion(185)).toBe("3 h 05 min");
  });
});

describe("aviso de fichaje abierto", () => {
  const inicio = utc("2026-10-26T00:00:00Z");

  it("avisa solo cuando un fichaje abierto supera las horas configuradas", () => {
    expect(excedeHorasAbierto({ startedAt: inicio, endedAt: null }, 8, utc("2026-10-26T08:00:00Z"))).toBe(false);
    expect(excedeHorasAbierto({ startedAt: inicio, endedAt: null }, 8, utc("2026-10-26T08:00:01Z"))).toBe(true);
  });

  it("nunca avisa de un fichaje cerrado", () => {
    expect(
      excedeHorasAbierto(
        { startedAt: inicio, endedAt: utc("2026-10-27T00:00:00Z") },
        8,
        utc("2026-10-28T00:00:00Z"),
      ),
    ).toBe(false);
  });
});

describe("hora de Madrid", () => {
  it("convierte horas de invierno (UTC+1) y verano (UTC+2)", () => {
    expect(instanteDesdeHoraMadrid(2026, 1, 15, 9, 30).toISOString()).toBe("2026-01-15T08:30:00.000Z");
    expect(instanteDesdeHoraMadrid(2026, 7, 15, 9, 30).toISOString()).toBe("2026-07-15T07:30:00.000Z");
  });

  it("admite días desbordados", () => {
    expect(instanteDesdeHoraMadrid(2026, 10, 32).toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("resuelve la hora inexistente del cambio de marzo después del salto", () => {
    // El 29-03-2026 el reloj pasa de 02:00 a 03:00.
    expect(instanteDesdeHoraMadrid(2026, 3, 29, 2, 30).getTime()).toBeGreaterThanOrEqual(
      utc("2026-03-29T01:00:00Z").getTime(),
    );
    expect(instanteDesdeHoraMadrid(2026, 3, 29, 3, 0).toISOString()).toBe("2026-03-29T01:00:00.000Z");
  });

  it("convierte el valor de un datetime-local y vuelve al mismo texto", () => {
    const instante = instanteDesdeInputMadrid("2026-10-26T08:05");

    expect(instante?.toISOString()).toBe("2026-10-26T07:05:00.000Z");
    expect(inputMadridDesdeInstante(instante!)).toBe("2026-10-26T08:05");
  });

  it("rechaza valores mal formados o fechas imposibles", () => {
    expect(instanteDesdeInputMadrid("")).toBeNull();
    expect(instanteDesdeInputMadrid("2026-10-26 08:05")).toBeNull();
    expect(instanteDesdeInputMadrid("2026-02-30T08:00")).toBeNull();
    expect(instanteDesdeInputMadrid("2026-10-26T24:00")).toBeNull();
  });
});

describe("semanas del taller", () => {
  it("empiezan el lunes a medianoche en Madrid", () => {
    // Miércoles 28-10-2026, ya en horario de invierno.
    const semana = semanaDe(utc("2026-10-28T10:00:00Z"));

    expect(semana.clave).toBe("2026-10-26");
    expect(semana.inicio.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(semana.fin.toISOString()).toBe("2026-11-01T23:00:00.000Z");
  });

  it("el domingo por la noche en Madrid pertenece a su semana aunque en UTC sea otro día", () => {
    // Domingo 01-11-2026 a las 23:30 en Madrid = 22:30 UTC.
    expect(semanaDe(utc("2026-11-01T22:30:00Z")).clave).toBe("2026-10-26");
    // Lunes 02-11-2026 a las 00:30 en Madrid = domingo 23:30 UTC.
    expect(semanaDe(utc("2026-11-01T23:30:00Z")).clave).toBe("2026-11-02");
  });

  it("la semana del cambio de hora de octubre dura 169 horas", () => {
    const semana = semanaDesdeClave("2026-10-19", new Date());

    expect(semana.inicio.toISOString()).toBe("2026-10-18T22:00:00.000Z");
    expect(semana.fin.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect((semana.fin.getTime() - semana.inicio.getTime()) / 3_600_000).toBe(169);
  });

  it("la semana del cambio de hora de marzo dura 167 horas", () => {
    const semana = semanaDesdeClave("2026-03-23", new Date());

    expect((semana.fin.getTime() - semana.inicio.getTime()) / 3_600_000).toBe(167);
  });

  it("normaliza cualquier día a su lunes y usa la semana actual si la clave no vale", () => {
    const ahora = utc("2026-10-28T10:00:00Z");

    expect(semanaDesdeClave("2026-10-29", ahora).clave).toBe("2026-10-26");
    expect(semanaDesdeClave("2026-13-01", ahora).clave).toBe("2026-10-26");
    expect(semanaDesdeClave("basura", ahora).clave).toBe("2026-10-26");
    expect(semanaDesdeClave(undefined, ahora).clave).toBe("2026-10-26");
  });

  it("se desplaza semanas hacia delante y hacia atrás, cruzando de año", () => {
    const semana = semanaDesdeClave("2026-12-28", new Date());

    expect(desplazarSemana(semana, 1).clave).toBe("2027-01-04");
    expect(desplazarSemana(semana, -1).clave).toBe("2026-12-21");
  });
});
