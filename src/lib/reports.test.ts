import { describe, expect, it } from "vitest";

import { minutosPorReparacion, minutosPorTrabajador } from "@/lib/reports";

const utc = (iso: string) => new Date(iso);
const ahora = utc("2026-10-28T12:00:00Z");
const ana = { id: "u-ana", name: "Ana" };
const bea = { id: "u-bea", name: "Bea" };
const carlos = { id: "u-carlos", name: "Carlos" };
const r1 = { id: "r1", brand: "HP" };
const r2 = { id: "r2", brand: "Lenovo" };

function fichaje(
  user: typeof ana,
  request: typeof r1 | null,
  inicio: string,
  fin: string | null,
) {
  return { user, request, startedAt: utc(inicio), endedAt: fin ? utc(fin) : null };
}

describe("minutosPorTrabajador", () => {
  it("suma por trabajador, incluye a quien no fichó y ordena por minutos", () => {
    const filas = minutosPorTrabajador(
      [
        fichaje(ana, r1, "2026-10-26T08:00:00Z", "2026-10-26T10:00:00Z"),
        fichaje(bea, r2, "2026-10-26T08:00:00Z", "2026-10-26T13:00:00Z"),
        fichaje(ana, null, "2026-10-27T08:00:00Z", "2026-10-27T08:30:00Z"),
      ],
      [ana, bea, carlos],
      ahora,
    );

    expect(filas).toEqual([
      { ...bea, minutos: 300, fichajes: 1 },
      { ...ana, minutos: 150, fichajes: 2 },
      { ...carlos, minutos: 0, fichajes: 0 },
    ]);
  });

  it("un fichaje abierto cuenta hasta ahora", () => {
    const [fila] = minutosPorTrabajador(
      [fichaje(ana, r1, "2026-10-28T10:00:00Z", null)],
      [ana],
      ahora,
    );

    expect(fila?.minutos).toBe(120);
  });

  it("incluye a quien fichó aunque ya no esté en la lista de trabajadores", () => {
    const filas = minutosPorTrabajador(
      [fichaje(carlos, r1, "2026-10-26T08:00:00Z", "2026-10-26T09:00:00Z")],
      [ana],
      ahora,
    );

    expect(filas.map((fila) => fila.id)).toEqual(["u-carlos", "u-ana"]);
  });

  it("las duraciones no dependen del cambio de hora (semana del 25-10-2026)", () => {
    // Sábado 24-10 22:00 Madrid (20:00 UTC) a domingo 25-10 06:00 Madrid (05:00 UTC):
    // 9 horas reales aunque el reloj de pared marque 8.
    const [fila] = minutosPorTrabajador(
      [fichaje(ana, r1, "2026-10-24T20:00:00Z", "2026-10-25T05:00:00Z")],
      [ana],
      ahora,
    );

    expect(fila?.minutos).toBe(540);
  });
});

describe("minutosPorReparacion", () => {
  it("agrupa la semana por reparación y añade el acumulado histórico", () => {
    const semana = [
      fichaje(ana, r1, "2026-10-26T08:00:00Z", "2026-10-26T09:00:00Z"),
      fichaje(bea, r1, "2026-10-27T08:00:00Z", "2026-10-27T08:30:00Z"),
      fichaje(bea, r2, "2026-10-27T09:00:00Z", "2026-10-27T12:00:00Z"),
      fichaje(ana, null, "2026-10-27T13:00:00Z", "2026-10-27T13:45:00Z"),
    ];
    const historicos = [
      ...semana.filter((item) => item.request),
      fichaje(ana, r1, "2026-10-19T08:00:00Z", "2026-10-19T12:00:00Z"),
    ];

    expect(minutosPorReparacion(semana, historicos, ahora)).toEqual([
      { request: r2, minutosSemana: 180, minutosAcumulados: 180 },
      { request: r1, minutosSemana: 90, minutosAcumulados: 330 },
      { request: null, minutosSemana: 45, minutosAcumulados: null },
    ]);
  });

  it("ignora en el acumulado reparaciones que no aparecen en la semana", () => {
    const filas = minutosPorReparacion(
      [fichaje(ana, r1, "2026-10-26T08:00:00Z", "2026-10-26T09:00:00Z")],
      [fichaje(ana, r2, "2026-10-19T08:00:00Z", "2026-10-19T09:00:00Z")],
      ahora,
    );

    expect(filas).toEqual([{ request: r1, minutosSemana: 60, minutosAcumulados: 0 }]);
  });
});
