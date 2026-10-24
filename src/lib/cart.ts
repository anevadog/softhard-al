import type { ProductoPublico } from "@/lib/products";

export const CART_STORAGE_KEY = "softhard-carrito-v1";
export const CART_VERSION = 1 as const;
export const MAX_CART_ITEMS = 50;

const MAX_PRODUCT_ID_LENGTH = 100;
const MAX_QUANTITY = 999_999;

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CartState = {
  version: typeof CART_VERSION;
  items: CartItem[];
};

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function stockDisponible(stock: number): number {
  if (!Number.isFinite(stock)) {
    return 0;
  }

  return Math.max(0, Math.floor(stock));
}

export function serializarCarrito(items: CartItem[]): string {
  const estado: CartState = { version: CART_VERSION, items };

  return JSON.stringify(estado);
}

/**
 * Limpia datos procedentes de LocalStorage: descarta versiones antiguas,
 * entradas inválidas, duplicados y cantidades fuera de rango.
 */
export function normalizarCarrito(valor: unknown): CartItem[] {
  if (
    !esRegistro(valor) ||
    valor.version !== CART_VERSION ||
    !Array.isArray(valor.items)
  ) {
    return [];
  }

  const acumulado = new Map<string, number>();

  for (const item of valor.items) {
    if (!esRegistro(item)) {
      continue;
    }

    const productId =
      typeof item.productId === "string" ? item.productId.trim() : "";
    const quantity = item.quantity;

    if (
      productId === "" ||
      productId.length > MAX_PRODUCT_ID_LENGTH ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      continue;
    }

    if (
      acumulado.size >= MAX_CART_ITEMS &&
      !acumulado.has(productId)
    ) {
      continue;
    }

    const cantidadAcumulada = Math.min(
      MAX_QUANTITY,
      (acumulado.get(productId) ?? 0) + quantity,
    );

    acumulado.set(productId, cantidadAcumulada);
  }

  return Array.from(acumulado, ([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export function parsearCarrito(raw: string | null): CartItem[] {
  if (!raw) {
    return [];
  }

  try {
    return normalizarCarrito(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function agregarProducto(
  items: CartItem[],
  productId: string,
  stock: number,
): CartItem[] {
  const id = productId.trim();
  const disponible = stockDisponible(stock);

  if (id === "" || disponible <= 0) {
    return items;
  }

  const existente = items.find((item) => item.productId === id);

  if (!existente) {
    if (items.length >= MAX_CART_ITEMS) {
      return items;
    }

    return [...items, { productId: id, quantity: 1 }];
  }

  if (existente.quantity >= disponible) {
    return items;
  }

  return items.map((item) =>
    item.productId === id
      ? { ...item, quantity: Math.min(item.quantity + 1, disponible) }
      : item,
  );
}

export function actualizarCantidad(
  items: CartItem[],
  productId: string,
  cantidad: number,
  stock: number,
): CartItem[] {
  const id = productId.trim();
  const disponible = stockDisponible(stock);

  if (
    id === "" ||
    disponible <= 0 ||
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    return eliminarProducto(items, id);
  }

  const cantidadFinal = Math.min(Math.floor(cantidad), disponible);

  if (cantidadFinal <= 0) {
    return eliminarProducto(items, id);
  }

  return items.map((item) =>
    item.productId === id ? { ...item, quantity: cantidadFinal } : item,
  );
}

export function eliminarProducto(
  items: CartItem[],
  productId: string,
): CartItem[] {
  const id = productId.trim();

  return items.filter((item) => item.productId !== id);
}

export function contarUnidades(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function cantidadEnCarrito(
  items: CartItem[],
  productId: string,
): number {
  return items.find((item) => item.productId === productId)?.quantity ?? 0;
}

export function calcularSubtotalCentimos(
  precio: number,
  cantidad: number,
): number {
  if (
    !Number.isFinite(precio) ||
    !Number.isFinite(cantidad) ||
    precio <= 0 ||
    cantidad <= 0
  ) {
    return 0;
  }

  return Math.round(precio * 100) * Math.floor(cantidad);
}

export function calcularTotalCentimos(
  items: CartItem[],
  productos: readonly Pick<ProductoPublico, "id" | "price">[],
): number {
  const precios = new Map(
    productos.map((producto) => [producto.id, producto.price]),
  );

  return items.reduce(
    (total, item) =>
      total +
      calcularSubtotalCentimos(
        precios.get(item.productId) ?? 0,
        item.quantity,
      ),
    0,
  );
}
