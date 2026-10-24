import { describe, expect, it } from "vitest";

import {
  CART_VERSION,
  actualizarCantidad,
  agregarProducto,
  cantidadEnCarrito,
  calcularSubtotalCentimos,
  calcularTotalCentimos,
  contarUnidades,
  eliminarProducto,
  normalizarCarrito,
  parsearCarrito,
  serializarCarrito,
} from "@/lib/cart";

const PRODUCTOS = [
  { id: "prod-a", price: 19.99 },
  { id: "prod-b", price: 5 },
];

describe("persistencia del carrito", () => {
  it("serializa y recupera las líneas guardadas", () => {
    const items = [{ productId: "prod-a", quantity: 2 }];
    const raw = serializarCarrito(items);

    expect(JSON.parse(raw)).toEqual({ version: CART_VERSION, items });
    expect(parsearCarrito(raw)).toEqual(items);
  });

  it("descarta JSON inválido o versiones antiguas", () => {
    expect(parsearCarrito("no-es-json")).toEqual([]);
    expect(parsearCarrito(null)).toEqual([]);
    expect(
      normalizarCarrito({
        version: 0,
        items: [{ productId: "prod-a", quantity: 1 }],
      }),
    ).toEqual([]);
  });

  it("limpia entradas inválidas y fusiona duplicados", () => {
    expect(
      normalizarCarrito({
        version: CART_VERSION,
        items: [
          { productId: " prod-a ", quantity: 1 },
          { productId: "prod-a", quantity: 2 },
          { productId: "", quantity: 1 },
          { productId: "prod-b", quantity: 0 },
          { productId: "prod-b", quantity: 1.5 },
          { productId: "prod-c", quantity: 3 },
        ],
      }),
    ).toEqual([
      { productId: "prod-a", quantity: 3 },
      { productId: "prod-c", quantity: 3 },
    ]);
  });
});

describe("operaciones del carrito", () => {
  it("añade un producto nuevo y respeta el stock", () => {
    const nuevo = agregarProducto([], "prod-a", 2);

    expect(nuevo).toEqual([{ productId: "prod-a", quantity: 1 }]);
    expect(agregarProducto(nuevo, "prod-a", 2)[0]?.quantity).toBe(2);
    expect(agregarProducto(nuevo, "prod-b", 0)).toEqual(nuevo);
  });

  it("no supera el stock disponible al añadir", () => {
    const items = [{ productId: "prod-a", quantity: 2 }];

    expect(agregarProducto(items, "prod-a", 2)).toEqual(items);
  });

  it("actualiza la cantidad, la recorta al stock y elimina si no hay stock", () => {
    const items = [{ productId: "prod-a", quantity: 2 }];

    expect(actualizarCantidad(items, "prod-a", 4, 3)).toEqual([
      { productId: "prod-a", quantity: 3 },
    ]);
    expect(actualizarCantidad(items, "prod-a", 0, 3)).toEqual([]);
    expect(actualizarCantidad(items, "prod-a", 2, 0)).toEqual([]);
  });

  it("elimina una línea y calcula unidades y cantidades", () => {
    const items = [
      { productId: "prod-a", quantity: 2 },
      { productId: "prod-b", quantity: 1 },
    ];

    expect(contarUnidades(items)).toBe(3);
    expect(cantidadEnCarrito(items, "prod-a")).toBe(2);
    expect(cantidadEnCarrito(items, "prod-c")).toBe(0);
    expect(eliminarProducto(items, "prod-a")).toEqual([
      { productId: "prod-b", quantity: 1 },
    ]);
  });
});

describe("importes del carrito", () => {
  it("calcula subtotales en céntimos sin errores de coma flotante", () => {
    expect(calcularSubtotalCentimos(19.99, 3)).toBe(5997);
    expect(calcularSubtotalCentimos(19.99, 0)).toBe(0);
  });

  it("suma el total de las líneas con producto conocido", () => {
    const items = [
      { productId: "prod-a", quantity: 3 },
      { productId: "prod-b", quantity: 2 },
      { productId: "prod-inexistente", quantity: 1 },
    ];

    expect(calcularTotalCentimos(items, PRODUCTOS)).toBe(6997);
  });
});
