import { describe, expect, it } from "vitest";

import { nombreFicheroCsv, ultimosDias } from "@/lib/exports";
import {
  filtrosIngresosSchema,
  filtrosPedidosSchema,
  filtrosReparacionesSchema,
} from "@/lib/validations/exports";

const mensajes = (resultado: { success: boolean; error?: { issues: { message: string }[] } }) =>
  resultado.error?.issues.map((issue) => issue.message) ?? [];

describe("rango de fechas", () => {
  it("convierte días de Madrid en instantes, con hasta incluido", () => {
    const datos = filtrosIngresosSchema.parse({ desde: "2026-10-01", hasta: "2026-10-31" });

    // 1/10 00:00 (UTC+2) → 1/11 00:00 (UTC+1), por el cambio de hora.
    expect(datos.rango.inicio.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(datos.rango.fin.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("es obligatorio y con formato AAAA-MM-DD válido", () => {
    expect(filtrosPedidosSchema.safeParse({}).success).toBe(false);
    expect(filtrosPedidosSchema.safeParse({ desde: "2026-10-01" }).success).toBe(false);
    expect(mensajes(filtrosPedidosSchema.safeParse({ desde: "01/10/2026", hasta: "2026-10-31" }))).toContain(
      "La fecha de inicio no es válida (AAAA-MM-DD)",
    );
    expect(filtrosPedidosSchema.safeParse({ desde: "2026-02-30", hasta: "2026-03-01" }).success).toBe(false);
  });

  it("rechaza un fin anterior al inicio y más de 366 días", () => {
    expect(mensajes(filtrosPedidosSchema.safeParse({ desde: "2026-10-02", hasta: "2026-10-01" }))).toEqual([
      "La fecha de fin es anterior a la de inicio",
    ]);
    // 2024 es bisiesto: 1/1 a 31/12 son exactamente 366 días.
    expect(filtrosPedidosSchema.safeParse({ desde: "2024-01-01", hasta: "2024-12-31" }).success).toBe(true);
    expect(mensajes(filtrosPedidosSchema.safeParse({ desde: "2024-01-01", hasta: "2025-01-01" }))).toEqual([
      "El rango no puede superar los 366 días",
    ]);
  });

  it("un mismo día es un rango válido", () => {
    expect(filtrosReparacionesSchema.safeParse({ desde: "2026-10-29", hasta: "2026-10-29" }).success).toBe(true);
  });
});

describe("filtros opcionales", () => {
  const rango = { desde: "2026-10-01", hasta: "2026-10-31" };

  it("estado y concepto válidos; vacío cuenta como ausente", () => {
    expect(filtrosPedidosSchema.parse({ ...rango, estado: "caducado" }).estado).toBe("caducado");
    expect(filtrosPedidosSchema.parse({ ...rango, estado: "" }).estado).toBeUndefined();
    expect(filtrosReparacionesSchema.parse({ ...rango, estado: "lista" }).estado).toBe("lista");
    expect(filtrosIngresosSchema.parse({ ...rango, concepto: "venta", serie: "MIG" })).toMatchObject({
      concepto: "venta",
      serie: "MIG",
    });
  });

  it("rechaza valores desconocidos", () => {
    expect(mensajes(filtrosPedidosSchema.safeParse({ ...rango, estado: "lista" }))).toEqual([
      "Estado de pedido no válido",
    ]);
    expect(mensajes(filtrosReparacionesSchema.safeParse({ ...rango, estado: "pagado" }))).toEqual([
      "Estado de reparación no válido",
    ]);
    expect(mensajes(filtrosIngresosSchema.safeParse({ ...rango, concepto: "otro" }))).toEqual([
      "Concepto no válido",
    ]);
  });
});

describe("utilidades", () => {
  it("nombre de fichero con el rango", () => {
    expect(nombreFicheroCsv("ingresos", { desde: "2026-10-01", hasta: "2026-10-31" })).toBe(
      "ingresos_2026-10-01_2026-10-31.csv",
    );
  });

  it("últimos 30 días hasta hoy en Madrid", () => {
    // 01/11/2026 00:30 en Madrid: hoy ya es 1 de noviembre.
    expect(ultimosDias(new Date("2026-10-31T23:30:00Z"), 30)).toEqual({
      desde: "2026-10-03",
      hasta: "2026-11-01",
    });
  });
});
