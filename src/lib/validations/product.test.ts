import { describe, expect, it } from "vitest";

import {
  productCreateSchema,
  productEditSchema,
  productIdSchema,
} from "@/lib/validations/product";

const VALID = {
  name: "Teclado mecánico Keychron K2",
  description: "Teclado inalámbrico con retroiluminación y switches táctiles.",
  price: "49,90",
  stock: "12",
  category: "accesorios",
  imageUrl: "https://example.com/teclado.jpg",
} as const;

describe("productCreateSchema", () => {
  it("acepta un producto válido y transforma precio y stock", () => {
    const result = productCreateSchema.parse(VALID);

    expect(result.price).toBe(49.9);
    expect(result.stock).toBe(12);
    expect(result.imageUrl).toBe("https://example.com/teclado.jpg");
  });

  it("recorta espacios en nombre y descripción", () => {
    const result = productCreateSchema.parse({
      ...VALID,
      name: "  Teclado  ",
      description: "  Teclado inalámbrico con retroiluminación.  ",
    });

    expect(result.name).toBe("Teclado");
    expect(result.description).toBe("Teclado inalámbrico con retroiluminación.");
  });

  it("acepta precios con punto decimal", () => {
    expect(productCreateSchema.parse({ ...VALID, price: "49.90" }).price).toBe(49.9);
  });

  it("rechaza un precio de 0 o negativo", () => {
    expect(productCreateSchema.safeParse({ ...VALID, price: "0" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...VALID, price: "-5" }).success).toBe(false);
  });

  it("rechaza un precio con más de dos decimales", () => {
    expect(productCreateSchema.safeParse({ ...VALID, price: "49,999" }).success).toBe(false);
  });

  it("rechaza un precio por encima del máximo", () => {
    expect(productCreateSchema.safeParse({ ...VALID, price: "1000000" }).success).toBe(false);
  });

  it("acepta stock 0", () => {
    expect(productCreateSchema.parse({ ...VALID, stock: "0" }).stock).toBe(0);
  });

  it("rechaza stock decimal, negativo o demasiado grande", () => {
    expect(productCreateSchema.safeParse({ ...VALID, stock: "1.5" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...VALID, stock: "-1" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...VALID, stock: "1000000" }).success).toBe(false);
  });

  it("rechaza una categoría que no existe", () => {
    expect(productCreateSchema.safeParse({ ...VALID, category: "videojuegos" }).success).toBe(false);
  });

  it("convierte una URL de imagen vacía en null", () => {
    expect(productCreateSchema.parse({ ...VALID, imageUrl: "" }).imageUrl).toBeNull();
  });

  it("rechaza URLs que no son http o https", () => {
    expect(
      productCreateSchema.safeParse({ ...VALID, imageUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      productCreateSchema.safeParse({ ...VALID, imageUrl: "/productos/placeholder.svg" })
        .success,
    ).toBe(false);
  });

  it("rechaza un nombre demasiado corto y una descripción demasiado corta", () => {
    expect(productCreateSchema.safeParse({ ...VALID, name: "A" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...VALID, description: "Corto" }).success).toBe(
      false,
    );
  });

  it("descarta campos que el formulario no controla", () => {
    const result = productCreateSchema.parse({
      ...VALID,
      id: "producto-ajeno",
      active: false,
      createdAt: "2030-01-01T00:00:00.000Z",
    });

    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("active");
    expect(result).not.toHaveProperty("createdAt");
  });

  it("rechaza un formulario sin campos", () => {
    expect(productCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe("productEditSchema", () => {
  const SIN_STOCK = {
    name: VALID.name,
    description: VALID.description,
    price: VALID.price,
    category: VALID.category,
    imageUrl: VALID.imageUrl,
  };

  it("acepta una edición sin stock y descarta el stock inyectado", () => {
    const result = productEditSchema.parse({
      ...SIN_STOCK,
      stock: "999",
    });

    expect(result.price).toBe(49.9);
    expect(result).not.toHaveProperty("stock");
  });

  it("mantiene la validación de los campos editables", () => {
    expect(productEditSchema.safeParse({ ...SIN_STOCK, price: "0" }).success).toBe(
      false,
    );
    expect(
      productEditSchema.safeParse({ ...SIN_STOCK, name: "A" }).success,
    ).toBe(false);
  });

  it("rechaza una edición sin campos obligatorios", () => {
    expect(productEditSchema.safeParse({}).success).toBe(false);
  });
});

describe("productIdSchema", () => {
  it("acepta un identificador normal y lo recorta", () => {
    expect(productIdSchema.parse(" demo-prod-thinkpad-t14 ")).toBe(
      "demo-prod-thinkpad-t14",
    );
  });

  it("rechaza identificadores vacíos o solo con espacios", () => {
    expect(productIdSchema.safeParse("").success).toBe(false);
    expect(productIdSchema.safeParse("   ").success).toBe(false);
  });

  it("rechaza identificadores de más de 64 caracteres", () => {
    expect(productIdSchema.safeParse("a".repeat(65)).success).toBe(false);
  });
});
