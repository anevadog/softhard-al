import { describe, expect, it } from "vitest";

import { cambioEstadoSchema } from "@/lib/validations/workshop";

const VALID = {
  requestId: "cmvjq59860000mgwbex9gdgjz",
  estadoEsperado: "aceptada",
  estadoNuevo: "en_reparacion",
  motivo: "",
} as const;

describe("cambioEstadoSchema", () => {
  it("acepta un cambio al flujo nuevo, incluido esperando repuesto", () => {
    expect(
      cambioEstadoSchema.parse({ ...VALID, estadoNuevo: "esperando_repuesto" })
        .estadoNuevo,
    ).toBe("esperando_repuesto");
  });

  it("recorta el motivo y convierte el vacío en cadena vacía", () => {
    expect(
      cambioEstadoSchema.parse({ ...VALID, motivo: "  Falta pieza  " }).motivo,
    ).toBe("Falta pieza");
    expect(cambioEstadoSchema.parse(VALID).motivo).toBe("");
  });

  it("rechaza estados inventados en cualquiera de los dos campos", () => {
    expect(
      cambioEstadoSchema.safeParse({ ...VALID, estadoNuevo: "cancelada" })
        .success,
    ).toBe(false);
    expect(
      cambioEstadoSchema.safeParse({ ...VALID, estadoEsperado: "cancelada" })
        .success,
    ).toBe(false);
  });

  it("rechaza un motivo de más de 500 caracteres", () => {
    expect(
      cambioEstadoSchema.safeParse({ ...VALID, motivo: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rechaza un requestId vacío", () => {
    expect(
      cambioEstadoSchema.safeParse({ ...VALID, requestId: "  " }).success,
    ).toBe(false);
  });
});
