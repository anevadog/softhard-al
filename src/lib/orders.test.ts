import { describe, expect, it } from "vitest";

import {
  MAX_ORDER_TOTAL_CENTS,
  etiquetaEstadoPedido,
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
  });
});
