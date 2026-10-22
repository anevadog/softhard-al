import { describe, expect, it } from "vitest";

import { estadoSolicitudSchema, quoteSchema } from "@/lib/validations/quote";

const VALID = {
  requestId: "cmvjq59860000mgwbex9gdgjz",
  budgetAmount: "120,50",
} as const;

describe("quoteSchema", () => {
  it("acepta un importe con coma y lo convierte a número", () => {
    expect(quoteSchema.parse(VALID).budgetAmount).toBe(120.5);
  });

  it("acepta un importe con punto", () => {
    expect(quoteSchema.parse({ ...VALID, budgetAmount: "120.50" }).budgetAmount).toBe(120.5);
  });

  it("acepta un importe sin decimales", () => {
    expect(quoteSchema.parse({ ...VALID, budgetAmount: "120" }).budgetAmount).toBe(120);
  });

  it("recorta espacios alrededor del importe", () => {
    expect(quoteSchema.parse({ ...VALID, budgetAmount: "  120,50  " }).budgetAmount).toBe(120.5);
  });

  it("rechaza un importe vacío", () => {
    expect(quoteSchema.safeParse({ ...VALID, budgetAmount: "" }).success).toBe(false);
  });

  it("rechaza texto no numérico", () => {
    expect(quoteSchema.safeParse({ ...VALID, budgetAmount: "ciento veinte" }).success).toBe(false);
  });

  it("rechaza más de dos decimales", () => {
    expect(quoteSchema.safeParse({ ...VALID, budgetAmount: "120,505" }).success).toBe(false);
  });

  it("rechaza importes de cero o negativos", () => {
    expect(quoteSchema.safeParse({ ...VALID, budgetAmount: "0" }).success).toBe(false);
    expect(quoteSchema.safeParse({ ...VALID, budgetAmount: "-120" }).success).toBe(false);
  });

  it("rechaza importes fuera del rango admitido", () => {
    expect(quoteSchema.safeParse({ ...VALID, budgetAmount: "1000000" }).success).toBe(false);
  });

  it("descarta importes inyectados que no controla el formulario", () => {
    const result = quoteSchema.parse({
      ...VALID,
      diagnosticFee: "0",
      finalAmount: "0",
      status: "aceptado",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    expect(result).not.toHaveProperty("diagnosticFee");
    expect(result).not.toHaveProperty("finalAmount");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("expiresAt");
  });

  it("rechaza un requestId vacío", () => {
    expect(quoteSchema.safeParse({ ...VALID, requestId: "  " }).success).toBe(false);
  });
});

describe("estadoSolicitudSchema", () => {
  it("acepta cualquier estado del flujo", () => {
    expect(estadoSolicitudSchema.parse({ requestId: VALID.requestId, status: "en_reparacion" }).status).toBe(
      "en_reparacion",
    );
  });

  it("rechaza estados inventados", () => {
    expect(
      estadoSolicitudSchema.safeParse({ requestId: VALID.requestId, status: "cancelada" }).success,
    ).toBe(false);
  });
});
