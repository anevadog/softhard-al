import type { StockMovementReason } from "@/generated/prisma/enums";

/**
 * Tope operativo por movimiento manual. No es un límite de negocio: evita que
 * un error de tecleo (por ejemplo, añadir un cero de más) deje el stock absurdo.
 */
export const MAX_STOCK_VARIATION = 10_000;

/** Longitud máxima de la nota de un ajuste o reposición. */
export const MAX_STOCK_NOTE_LENGTH = 500;

/** Motivos que puede elegir una persona desde el panel. */
export const MOTIVOS_AJUSTE_STOCK = ["reposicion", "ajuste"] as const;

export type MotivoAjusteStock = (typeof MOTIVOS_AJUSTE_STOCK)[number];

export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  stock_inicial: "Stock inicial",
  venta: "Venta",
  cancelacion_pedido: "Cancelación de pedido",
  reposicion: "Reposición",
  ajuste: "Ajuste",
  caducidad_pedido: "Caducidad de pedido",
};

export function etiquetaMotivoStock(reason: StockMovementReason): string {
  return STOCK_MOVEMENT_REASON_LABELS[reason];
}

/** Texto corto y estable para identificar un pedido en el historial. */
export function abreviarPedido(orderId: string): string {
  return `Pedido ${orderId.slice(0, 8).toUpperCase()}`;
}
