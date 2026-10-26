import { describe, expect, it } from "vitest";

import {
  decisionSchema,
  estadoSolicitudSchema,
  quoteSchema,
} from "@/lib/validations/quote";

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

  it("no acepta todavía el estado nuevo desde el panel", () => {
    expect(
      estadoSolicitudSchema.safeParse({
        requestId: VALID.requestId,
        status: "esperando_repuesto",
      }).success,
    ).toBe(false);
  });
});

describe("decisionSchema", () => {
  it("acepta la decisión de aceptar", () => {
    expect(
      decisionSchema.parse({ requestId: VALID.requestId, decision: "aceptar" }).decision,
    ).toBe("aceptar");
  });

  it("acepta la decisión de rechazar", () => {
    expect(
      decisionSchema.parse({ requestId: VALID.requestId, decision: "rechazar" }).decision,
    ).toBe("rechazar");
  });

  it("rechaza decisiones inventadas", () => {
    expect(
      decisionSchema.safeParse({ requestId: VALID.requestId, decision: "cancelar" }).success,
    ).toBe(false);
  });

  it("rechaza una decisión vacía", () => {
    expect(
      decisionSchema.safeParse({ requestId: VALID.requestId, decision: "" }).success,
    ).toBe(false);
  });

  it("rechaza un requestId vacío", () => {
    expect(
      decisionSchema.safeParse({ requestId: "  ", decision: "aceptar" }).success,
    ).toBe(false);
  });

  it("descarta importes y estados inyectados en el formulario", () => {
    const result = decisionSchema.parse({
      requestId: VALID.requestId,
      decision: "aceptar",
      finalAmount: "0",
      budgetAmount: "1",
      status: "aceptada",
    });

    expect(result).not.toHaveProperty("finalAmount");
    expect(result).not.toHaveProperty("budgetAmount");
    expect(result).not.toHaveProperty("status");
  });
});
