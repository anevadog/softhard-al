import { describe, expect, it } from "vitest";

import {
  MAX_ORDER_TOTAL_CENTS,
  ORDER_STATUSES,
  calcularExpiracionPedido,
  etiquetaEstadoPedido,
  pedidoCaducado,
  puedeCambiarEstadoPedido,
  precioDesdeCentimos,
  prepararPedido,
  type ProductoParaPedido,
} from "@/lib/orders";

const PRODUCTOS: ProductoParaPedido[] = [
  { id: "prod-a", price: 19.99, stock: 5, active: true },
  { id: "prod-b", price: 5, stock: 10, active: true },
];

describe("preparación de pedidos", () => {
  it("calcula el total en céntimos y congela el precio de cada línea", () => {
    const resultado = prepararPedido(
      [
        { productId: "prod-a", quantity: 3 },
        { productId: "prod-b", quantity: 2 },
      ],
      PRODUCTOS,
    );

    expect(resultado).toEqual({
      ok: true,
      totalCentimos: 6997,
      lineas: [
        {
          productId: "prod-a",
          quantity: 3,
          priceCentimos: 1999,
          subtotalCentimos: 5997,
        },
        {
          productId: "prod-b",
          quantity: 2,
          priceCentimos: 500,
          subtotalCentimos: 1000,
        },
      ],
    });
  });

  it("rechaza un carrito vacío", () => {
    expect(prepararPedido([], PRODUCTOS)).toEqual({
      ok: false,
      motivo: "carrito-vacio",
    });
  });

  it("detecta productos duplicados", () => {
    expect(
      prepararPedido(
        [
          { productId: "prod-a", quantity: 1 },
          { productId: "prod-a", quantity: 2 },
        ],
        PRODUCTOS,
      ),
    ).toEqual({ ok: false, motivo: "datos-invalidos" });
  });

  it("rechaza cantidades no enteras o no positivas", () => {
    expect(
      prepararPedido([{ productId: "prod-a", quantity: 1.5 }], PRODUCTOS),
    ).toEqual({ ok: false, motivo: "datos-invalidos" });
    expect(
      prepararPedido([{ productId: "prod-a", quantity: 0 }], PRODUCTOS),
    ).toEqual({ ok: false, motivo: "datos-invalidos" });
  });

  it("detecta un producto inactivo o inexistente", () => {
    expect(
      prepararPedido(
        [{ productId: "prod-a", quantity: 1 }],
        [{ ...PRODUCTOS[0], active: false }],
      ),
    ).toEqual({
      ok: false,
      motivo: "producto-no-disponible",
      productIds: ["prod-a"],
    });

    expect(
      prepararPedido([{ productId: "prod-x", quantity: 1 }], PRODUCTOS),
    ).toEqual({
      ok: false,
      motivo: "producto-no-disponible",
      productIds: ["prod-x"],
    });
  });

  it("detecta stock insuficiente sin ajustar la cantidad en silencio", () => {
    expect(
      prepararPedido([{ productId: "prod-a", quantity: 6 }], PRODUCTOS),
    ).toEqual({
      ok: false,
      motivo: "stock-insuficiente",
      productIds: ["prod-a"],
    });
  });

  it("rechaza un total que no cabe en Decimal(10,2)", () => {
    const resultado = prepararPedido(
      [{ productId: "prod-caro", quantity: 101 }],
      [{ id: "prod-caro", price: 999999.99, stock: 200, active: true }],
    );

    expect(resultado).toEqual({ ok: false, motivo: "importe-excesivo" });
    expect(999999.99 * 100 * 101).toBeGreaterThan(MAX_ORDER_TOTAL_CENTS);
  });

  it("convierte céntimos a la cadena decimal de Prisma", () => {
    expect(precioDesdeCentimos(6997)).toBe("69.97");
    expect(precioDesdeCentimos(500)).toBe("5.00");
  });

  it("etiqueta los estados del pedido en español", () => {
    expect(etiquetaEstadoPedido("pendiente")).toBe("Pendiente");
    expect(etiquetaEstadoPedido("pagado")).toBe("Pagado");
    expect(etiquetaEstadoPedido("entregado")).toBe("Entregado");
    expect(etiquetaEstadoPedido("cancelado")).toBe("Cancelado");
    expect(etiquetaEstadoPedido("caducado")).toBe("Caducado");
  });
});

describe("caducidad de pedidos", () => {
  it("calcula la caducidad sumando las horas a la creación", () => {
    const creado = new Date("2026-10-24T10:00:00Z");

    expect(calcularExpiracionPedido(creado, 48)).toEqual(
      new Date("2026-10-26T10:00:00Z"),
    );
  });

  it("caduca exactamente en expiresAt y no antes", () => {
    const vence = new Date("2026-10-26T10:00:00Z");

    expect(pedidoCaducado(vence, new Date("2026-10-26T09:59:59.999Z"))).toBe(false);
    expect(pedidoCaducado(vence, vence)).toBe(true);
    expect(pedidoCaducado(vence, new Date("2026-10-27T00:00:00Z"))).toBe(true);
  });

  it("sin fecha de caducidad no caduca nunca", () => {
    expect(pedidoCaducado(null, new Date("2099-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("transiciones de pedido", () => {
  it("desde pendiente solo se cancela a mano: a pagado se llega registrando el cobro", () => {
    expect(puedeCambiarEstadoPedido("pendiente", "cancelado")).toBe(true);
    expect(puedeCambiarEstadoPedido("pendiente", "pagado")).toBe(false);
  });

  it("permite pagado → entregado y pagado → cancelado", () => {
    expect(puedeCambiarEstadoPedido("pagado", "entregado")).toBe(true);
    expect(puedeCambiarEstadoPedido("pagado", "cancelado")).toBe(true);
  });

  it("rechaza retrocesos y saltos no permitidos", () => {
    expect(puedeCambiarEstadoPedido("pendiente", "entregado")).toBe(false);
    expect(puedeCambiarEstadoPedido("pagado", "pendiente")).toBe(false);
    expect(puedeCambiarEstadoPedido("entregado", "pagado")).toBe(false);
    expect(puedeCambiarEstadoPedido("cancelado", "pendiente")).toBe(false);
  });

  it("trata entregado, cancelado y caducado como finales", () => {
    for (const estado of ["entregado", "cancelado", "caducado"] as const) {
      expect(puedeCambiarEstadoPedido(estado, "pendiente")).toBe(false);
      expect(puedeCambiarEstadoPedido(estado, "pagado")).toBe(false);
      expect(puedeCambiarEstadoPedido(estado, "entregado")).toBe(false);
      expect(puedeCambiarEstadoPedido(estado, "cancelado")).toBe(false);
    }
  });

  it("nadie puede pasar un pedido a caducado a mano", () => {
    for (const estado of ORDER_STATUSES) {
      expect(puedeCambiarEstadoPedido(estado, "caducado")).toBe(false);
    }
  });

  it("rechaza cambiar al mismo estado", () => {
    for (const estado of ORDER_STATUSES) {
      expect(puedeCambiarEstadoPedido(estado, estado)).toBe(false);
    }
  });
});
