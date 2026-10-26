import { describe, expect, it } from "vitest";

import {
  cierreStaffSchema,
  correccionFichajeSchema,
  entradaGeneralSchema,
  salidaSchema,
} from "@/lib/validations/work-logs";

const CORRECCION = {
  workLogId: "wl-1",
  origen: "abiertos",
  inicio: "2026-10-20T08:00",
  fin: "2026-10-20T14:30",
  nota: "",
};

describe("entradaGeneralSchema", () => {
  it("exige una nota con texto", () => {
    expect(entradaGeneralSchema.safeParse({ nota: "   " }).success).toBe(false);
    expect(entradaGeneralSchema.parse({ nota: "  Inventario  " }).nota).toBe("Inventario");
  });

  it("limita la nota a 500 caracteres", () => {
    expect(entradaGeneralSchema.safeParse({ nota: "a".repeat(501) }).success).toBe(false);
  });
});

describe("salida y cierre", () => {
  it("un origen desconocido vuelve al valor por defecto", () => {
    expect(salidaSchema.parse({ workLogId: "wl-1", origen: "https://evil" }).origen).toBe("inicio");
    expect(cierreStaffSchema.parse({ workLogId: "wl-1", origen: "x" }).origen).toBe("abiertos");
  });

  it("exige el identificador del fichaje", () => {
    expect(salidaSchema.safeParse({ workLogId: "", origen: "inicio" }).success).toBe(false);
  });
});

describe("correccionFichajeSchema", () => {
  it("convierte las horas de Madrid a UTC", () => {
    const datos = correccionFichajeSchema.parse(CORRECCION);

    expect(datos.inicio.toISOString()).toBe("2026-10-20T06:00:00.000Z");
    expect(datos.fin?.toISOString()).toBe("2026-10-20T12:30:00.000Z");
  });

  it("una salida vacía significa fichaje abierto", () => {
    expect(correccionFichajeSchema.parse({ ...CORRECCION, fin: "" }).fin).toBeNull();
  });

  it("rechaza una salida anterior a la entrada", () => {
    const resultado = correccionFichajeSchema.safeParse({
      ...CORRECCION,
      fin: "2026-10-20T07:59",
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(["fin"]);
  });

  it("rechaza horas en el futuro", () => {
    const resultado = correccionFichajeSchema.safeParse({
      ...CORRECCION,
      inicio: "2099-01-01T08:00",
      fin: "",
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(["inicio"]);
  });

  it("rechaza fechas mal formadas", () => {
    expect(correccionFichajeSchema.safeParse({ ...CORRECCION, inicio: "ayer" }).success).toBe(false);
    expect(correccionFichajeSchema.safeParse({ ...CORRECCION, fin: "2026-02-30T08:00" }).success).toBe(false);
  });
});
