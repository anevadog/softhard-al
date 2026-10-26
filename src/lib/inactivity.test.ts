import { describe, expect, it } from "vitest";

import {
  describirInactividad,
  estaDescuidada,
  horasSinActividad,
  limiteInactividad,
} from "@/lib/inactivity";

const ahora = new Date("2026-10-28T12:00:00Z");

describe("inactividad", () => {
  it("calcula el límite restando las horas configuradas", () => {
    expect(limiteInactividad(ahora, 48).toISOString()).toBe("2026-10-26T12:00:00.000Z");
  });

  it("exactamente en el plazo no avisa; un milisegundo antes, sí", () => {
    expect(estaDescuidada(new Date("2026-10-26T12:00:00.000Z"), 48, ahora)).toBe(false);
    expect(estaDescuidada(new Date("2026-10-26T11:59:59.999Z"), 48, ahora)).toBe(true);
  });

  it("una actividad reciente quita el aviso", () => {
    expect(estaDescuidada(new Date("2026-10-28T11:00:00Z"), 48, ahora)).toBe(false);
  });

  it("respeta otro valor de configuración", () => {
    expect(estaDescuidada(new Date("2026-10-28T09:00:00Z"), 2, ahora)).toBe(true);
  });

  it("cuenta horas completas y nunca negativas", () => {
    expect(horasSinActividad(new Date("2026-10-26T10:30:00Z"), ahora)).toBe(49);
    expect(horasSinActividad(new Date("2026-10-29T10:30:00Z"), ahora)).toBe(0);
  });

  it("describe en horas hasta 72 y después en días", () => {
    expect(describirInactividad(new Date("2026-10-26T08:00:00Z"), ahora)).toBe("hace 52 h");
    expect(describirInactividad(new Date("2026-10-25T12:00:00Z"), ahora)).toBe("hace 3 días");
  });
});
