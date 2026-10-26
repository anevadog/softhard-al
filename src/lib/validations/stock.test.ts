import { describe, expect, it } from "vitest";

import { MAX_STOCK_NOTE_LENGTH, MAX_STOCK_VARIATION } from "@/lib/stock";
import { stockAdjustmentSchema } from "@/lib/validations/stock";

const BASE = {
  productId: "demo-prod-keychron-k2",
  reason: "reposicion",
  variation: "5",
  note: "",
} as const;

describe("stockAdjustmentSchema", () => {
  it("acepta una reposición positiva sin nota y la deja en null", () => {
    const result = stockAdjustmentSchema.parse(BASE);

    expect(result.variation).toBe(5);
    expect(result.note).toBeNull();
  });

  it("acepta un ajuste negativo con nota", () => {
    const result = stockAdjustmentSchema.parse({
      ...BASE,
      reason: "ajuste",
      variation: "-3",
      note: "  Rotura en almacén  ",
    });

    expect(result.variation).toBe(-3);
    expect(result.note).toBe("Rotura en almacén");
  });

  it("rechaza variación cero, decimal o no numérica", () => {
    expect(stockAdjustmentSchema.safeParse({ ...BASE, variation: "0" }).success).toBe(
      false,
    );
    expect(
      stockAdjustmentSchema.safeParse({ ...BASE, variation: "1.5" }).success,
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({ ...BASE, variation: "cinco" }).success,
    ).toBe(false);
  });

  it("rechaza una reposición negativa o cero", () => {
    expect(
      stockAdjustmentSchema.safeParse({ ...BASE, variation: "-1" }).success,
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({ ...BASE, variation: "0" }).success,
    ).toBe(false);
  });

  it("exige nota en un ajuste", () => {
    const result = stockAdjustmentSchema.safeParse({
      ...BASE,
      reason: "ajuste",
      variation: "-1",
      note: "   ",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.note?.[0]).toBe(
        "La nota es obligatoria para un ajuste",
      );
    }
  });

  it("rechaza variaciones por encima del máximo", () => {
    expect(
      stockAdjustmentSchema.safeParse({
        ...BASE,
        variation: String(MAX_STOCK_VARIATION + 1),
      }).success,
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({
        ...BASE,
        variation: String(-MAX_STOCK_VARIATION - 1),
      }).success,
    ).toBe(false);
  });

  it("rechaza una nota demasiado larga y un motivo desconocido", () => {
    expect(
      stockAdjustmentSchema.safeParse({
        ...BASE,
        note: "a".repeat(MAX_STOCK_NOTE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({ ...BASE, reason: "venta" }).success,
    ).toBe(false);
  });
});
