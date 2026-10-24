import { describe, expect, it } from "vitest";

import {
  estadoStock,
  hrefCategoriaProducto,
  parseCategoriaProducto,
  textoStock,
} from "@/lib/catalog";

describe("categorías del catálogo", () => {
  it("normaliza una categoría válida", () => {
    expect(parseCategoriaProducto(" portatiles ")).toBe("portatiles");
    expect(parseCategoriaProducto("IMPRESORAS")).toBe("impresoras");
  });

  it("usa el primer valor cuando llegan varios parámetros", () => {
    expect(parseCategoriaProducto(["consumibles", "accesorios"])).toBe(
      "consumibles",
    );
  });

  it("devuelve null para todos, vacío o una categoría desconocida", () => {
    expect(parseCategoriaProducto("todos")).toBeNull();
    expect(parseCategoriaProducto("")).toBeNull();
    expect(parseCategoriaProducto("monitores")).toBeNull();
    expect(parseCategoriaProducto(undefined)).toBeNull();
  });
});

describe("URLs de filtro", () => {
  it("apunta al catálogo completo sin categoría", () => {
    expect(hrefCategoriaProducto(null)).toBe("/productos");
  });

  it("conserva la categoría seleccionada", () => {
    expect(hrefCategoriaProducto("portatiles")).toBe(
      "/productos?categoria=portatiles",
    );
  });
});

describe("estado y texto del stock", () => {
  it("marca el stock cero como agotado", () => {
    expect(estadoStock(0)).toBe("agotado");
    expect(textoStock(0)).toBe("Agotado");
  });

  it("avisa cuando quedan pocas unidades", () => {
    expect(estadoStock(1)).toBe("bajo");
    expect(estadoStock(3)).toBe("bajo");
    expect(textoStock(1)).toBe("Queda 1 unidad");
    expect(textoStock(2)).toBe("Quedan 2 unidades");
    expect(textoStock(3)).toBe("Quedan 3 unidades");
  });

  it("muestra el stock disponible a partir de cuatro unidades", () => {
    expect(estadoStock(4)).toBe("disponible");
    expect(textoStock(4)).toBe("4 unidades disponibles");
  });
});
