import type { OrderStatus } from "@/generated/prisma/enums";

/** Estados en el orden del flujo. Deben coincidir con el enum de Prisma. */
export const ORDER_STATUSES = [
  "pendiente",
  "pagado",
  "entregado",
  "cancelado",
  "caducado",
] as const satisfies readonly OrderStatus[];

/** Clases Tailwind completas: deben ser literales para que el escáner las detecte. */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badgeClass: string }
> = {
  pendiente: {
    label: "Pendiente",
    badgeClass: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  pagado: {
    label: "Pagado",
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  entregado: {
    label: "Entregado",
    badgeClass: "bg-slate-100 text-slate-700 ring-slate-300",
  },
  cancelado: {
    label: "Cancelado",
    badgeClass: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  caducado: {
    label: "Caducado",
    badgeClass: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  },
};

export function etiquetaEstadoPedido(status: OrderStatus): string {
  return ORDER_STATUS_META[status].label;
}

/**
 * Regla única de transición del pedido hecha por personas. `pagado` se marca a
 * mano porque no hay pasarela; entregado, cancelado y caducado son finales.
 * `caducado` no aparece como destino: solo lo pone el sistema al vencer el
 * pedido (`liberarPedidosCaducados`).
 */
const TRANSICIONES_PEDIDO: Record<OrderStatus, readonly OrderStatus[]> = {
  pendiente: ["pagado", "cancelado"],
  pagado: ["entregado", "cancelado"],
  entregado: [],
  cancelado: [],
  caducado: [],
};

export function puedeCambiarEstadoPedido(
  actual: OrderStatus,
  nuevo: OrderStatus,
): boolean {
  return TRANSICIONES_PEDIDO[actual].includes(nuevo);
}

const MS_POR_HORA = 60 * 60 * 1000;

/** Horas por defecto si no hay fila de `Config` (coincide con el default del esquema). */
export const PENDING_ORDER_HOURS_DEFECTO = 48;

/** Fecha de caducidad de un pedido pendiente: creación + N horas de `Config`. */
export function calcularExpiracionPedido(creadoEn: Date, horas: number): Date {
  return new Date(creadoEn.getTime() + horas * MS_POR_HORA);
}

/**
 * Un pedido caduca exactamente en `expiresAt` (límite inclusivo). Sin fecha no
 * caduca nunca.
 */
export function pedidoCaducado(expiresAt: Date | null, ahora: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= ahora.getTime();
}

/** Límite de `Decimal(10,2)` expresado en céntimos. */
export const MAX_ORDER_TOTAL_CENTS = 9_999_999_999;

export type ItemParaPedido = {
  productId: string;
  quantity: number;
};

export type ProductoParaPedido = {
  id: string;
  price: number;
  stock: number;
  active: boolean;
};

export type LineaPreparada = {
  productId: string;
  quantity: number;
  priceCentimos: number;
  subtotalCentimos: number;
};

export type MotivoPedidoInvalido =
  | "carrito-vacio"
  | "datos-invalidos"
  | "producto-no-disponible"
  | "stock-insuficiente"
  | "importe-excesivo";

export type ResultadoPreparacion =
  | {
      ok: true;
      lineas: LineaPreparada[];
      totalCentimos: number;
    }
  | {
      ok: false;
      motivo: MotivoPedidoInvalido;
      productIds?: string[];
    };

function aCentimos(precio: number): number | null {
  if (!Number.isFinite(precio) || precio <= 0) {
    return null;
  }

  const centimos = Math.round(precio * 100);

  return centimos > 0 ? centimos : null;
}

/**
 * Valida las líneas contra los productos reales y calcula el total en céntimos.
 * No toca la base de datos: recibe los productos ya consultados para poder
 * probar stock, precios e importes sin mocks.
 */
export function prepararPedido(
  items: readonly ItemParaPedido[],
  productos: readonly ProductoParaPedido[],
): ResultadoPreparacion {
  if (items.length === 0) {
    return { ok: false, motivo: "carrito-vacio" };
  }

  const productosPorId = new Map(
    productos.map((producto) => [producto.id, producto]),
  );
  const idsVistos = new Set<string>();
  const noDisponibles: string[] = [];
  const sinStock: string[] = [];
  const lineas: LineaPreparada[] = [];
  let totalCentimos = 0;

  for (const item of items) {
    const productId = item.productId.trim();

    if (
      productId === "" ||
      idsVistos.has(productId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      return { ok: false, motivo: "datos-invalidos" };
    }

    idsVistos.add(productId);

    const producto = productosPorId.get(productId);

    if (!producto || !producto.active) {
      noDisponibles.push(productId);
      continue;
    }

    const priceCentimos = aCentimos(producto.price);

    if (priceCentimos === null) {
      noDisponibles.push(productId);
      continue;
    }

    if (producto.stock < item.quantity) {
      sinStock.push(productId);
      continue;
    }

    const subtotalCentimos = priceCentimos * item.quantity;

    if (!Number.isSafeInteger(subtotalCentimos)) {
      return { ok: false, motivo: "importe-excesivo" };
    }

    totalCentimos += subtotalCentimos;
    lineas.push({
      productId,
      quantity: item.quantity,
      priceCentimos,
      subtotalCentimos,
    });
  }

  if (noDisponibles.length > 0) {
    return {
      ok: false,
      motivo: "producto-no-disponible",
      productIds: noDisponibles,
    };
  }

  if (sinStock.length > 0) {
    return {
      ok: false,
      motivo: "stock-insuficiente",
      productIds: sinStock,
    };
  }

  if (
    !Number.isSafeInteger(totalCentimos) ||
    totalCentimos <= 0 ||
    totalCentimos > MAX_ORDER_TOTAL_CENTS
  ) {
    return { ok: false, motivo: "importe-excesivo" };
  }

  return { ok: true, lineas, totalCentimos };
}

/** Convierte céntimos a la cadena decimal que espera Prisma. */
export function precioDesdeCentimos(centimos: number): string {
  return (centimos / 100).toFixed(2);
}

export type CheckoutActionResult =
  | { ok: true; pedidoId: string }
  | {
      ok: false;
      motivo: MotivoPedidoInvalido | "error";
      message: string;
      productIds?: string[];
    };

export type PedidoResumen = {
  id: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  expiresAt: Date | null;
  unidades: number;
  lineas: number;
};

export type PedidoLinea = {
  id: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  price: number;
  subtotal: number;
};

export type PedidoDetalle = {
  id: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  expiresAt: Date | null;
  items: PedidoLinea[];
};

export type ClientePedidoAdmin = {
  name: string;
  email: string;
  phone: string | null;
};

export type PedidoAdminResumen = {
  id: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  client: ClientePedidoAdmin;
};

export type PedidoAdminLinea = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
};

export type PedidoAdminDetalle = {
  id: string;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  expiresAt: Date | null;
  paidAt: Date | null;
  client: ClientePedidoAdmin;
  items: PedidoAdminLinea[];
};
