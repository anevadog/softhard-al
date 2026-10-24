import { describe, expect, it } from "vitest";

import { MAX_CART_ITEMS } from "@/lib/cart";
import { checkoutSchema } from "@/lib/validations/order";

const CLAVE = "123e4567-e89b-42d3-a456-426614174000";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId: "prod-a", quantity: 2 }],
    idempotencyKey: CLAVE,
    ...overrides,
  };
}

describe("validación del checkout", () => {
  it("acepta un carrito válido y recorta el id del producto", () => {
    const resultado = checkoutSchema.safeParse(
      payload({ items: [{ productId: " prod-a ", quantity: 2 }] }),
    );

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.items[0]?.productId).toBe("prod-a");
      expect(resultado.data.idempotencyKey).toBe(CLAVE);
    }
  });

  it("rechaza un carrito vacío", () => {
    expect(checkoutSchema.safeParse(payload({ items: [] })).success).toBe(false);
  });

  it("rechaza cantidades cero, negativas o decimales", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(
        checkoutSchema.safeParse(
          payload({ items: [{ productId: "prod-a", quantity }] }),
        ).success,
      ).toBe(false);
    }
  });

  it("rechaza un identificador vacío o demasiado largo", () => {
    expect(
      checkoutSchema.safeParse(
        payload({ items: [{ productId: " ", quantity: 1 }] }),
      ).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse(
        payload({ items: [{ productId: "x".repeat(101), quantity: 1 }] }),
      ).success,
    ).toBe(false);
  });

  it("rechaza productos duplicados", () => {
    expect(
      checkoutSchema.safeParse(
        payload({
          items: [
            { productId: "prod-a", quantity: 1 },
            { productId: "prod-a", quantity: 2 },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("rechaza más líneas de las permitidas", () => {
    const items = Array.from({ length: MAX_CART_ITEMS + 1 }, (_, index) => ({
      productId: `prod-${index}`,
      quantity: 1,
    }));

    expect(checkoutSchema.safeParse(payload({ items })).success).toBe(false);
  });

  it("rechaza una clave de idempotencia que no sea UUID", () => {
    expect(
      checkoutSchema.safeParse(payload({ idempotencyKey: "no-es-uuid" })).success,
    ).toBe(false);
  });
});
