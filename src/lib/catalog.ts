import type { ProductCategory } from "@/generated/prisma/enums";

import { PRODUCT_CATEGORIES } from "@/lib/products";

export type EstadoStock = "agotado" | "bajo" | "disponible";

/**
 * Normaliza el parámetro `categoria` de la URL.
 * Cualquier valor desconocido (incluido "todos") equivale a ver todo el catálogo.
 */
export function parseCategoriaProducto(
  valor: string | string[] | null | undefined,
): ProductCategory | null {
  const primero = Array.isArray(valor) ? valor[0] : valor;

  if (!primero) {
    return null;
  }

  const normalizado = primero.trim().toLowerCase();

  return (
    PRODUCT_CATEGORIES.find((categoria) => categoria === normalizado) ?? null
  );
}

/** URL del catálogo conservando el filtro de categoría cuando existe. */
export function hrefCategoriaProducto(
  categoria: ProductCategory | null,
): string {
  return categoria
    ? `/productos?categoria=${categoria}`
    : "/productos";
}

/** URL de la ficha pública, conservando el filtro desde el que se llega. */
export function hrefFichaProducto(
  id: string,
  categoria: ProductCategory | null,
): string {
  const base = `/productos/${encodeURIComponent(id)}`;

  return categoria ? `${base}?categoria=${categoria}` : base;
}

export function estadoStock(stock: number): EstadoStock {
  if (stock <= 0) {
    return "agotado";
  }

  if (stock <= 3) {
    return "bajo";
  }

  return "disponible";
}

/** Texto visible del stock, con singular y plural correctos. */
export function textoStock(stock: number): string {
  if (stock <= 0) {
    return "Agotado";
  }

  if (stock === 1) {
    return "Queda 1 unidad";
  }

  if (stock <= 3) {
    return `Quedan ${stock} unidades`;
  }

  return `${stock} unidades disponibles`;
}
