import type {
  OrderStatus,
  QuoteStatus,
  ServiceStatus,
} from "@/generated/prisma/enums";
import { pedidoCaducado } from "@/lib/orders";

/**
 * Métodos de cobro. Deben coincidir con el check SQL `*_payment_method_valid`.
 * `tarjeta_online` solo lo pone la pasarela (Fase 5); el staff registra a mano
 * los otros tres.
 */
export const PAYMENT_METHODS = [
  "efectivo",
  "bizum",
  "transferencia",
  "tarjeta_online",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const METODOS_PAGO_MANUAL = [
  "efectivo",
  "bizum",
  "transferencia",
] as const satisfies readonly PaymentMethod[];

export type MetodoPagoManual = (typeof METODOS_PAGO_MANUAL)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  bizum: "Bizum",
  transferencia: "Transferencia",
  tarjeta_online: "Tarjeta (pago online)",
};

/** Los cobros migrados no tienen método: se muestran como "No consta". */
export function etiquetaMetodoPago(metodo: string | null): string {
  return metodo && metodo in PAYMENT_METHOD_LABELS
    ? PAYMENT_METHOD_LABELS[metodo as PaymentMethod]
    : "No consta";
}

/** Longitud mínima del motivo cuando el admin cobra un importe distinto. */
export const MIN_MOTIVO_AJUSTE = 5;
export const MAX_NOTA_COBRO = 500;

export type DatosCobroPedido = {
  status: OrderStatus;
  total: number;
  expiresAt: Date | null;
  paidAt: Date | null;
};

/**
 * Importe que se espera cobrar de un pedido, o `null` si ahora no se puede
 * registrar su cobro: solo un pendiente sin cobrar y no vencido.
 */
export function cobroEsperadoPedido(
  pedido: DatosCobroPedido,
  ahora: Date,
): number | null {
  if (
    pedido.paidAt !== null ||
    pedido.status !== "pendiente" ||
    pedidoCaducado(pedido.expiresAt, ahora) ||
    pedido.total <= 0
  ) {
    return null;
  }

  return pedido.total;
}

export type PresupuestoCobro = {
  status: QuoteStatus;
  finalAmount: number | null;
  diagnosticFee: number;
};

export type DatosCobroSolicitud = {
  status: ServiceStatus;
  paidAt: Date | null;
  quote: PresupuestoCobro | null;
};

export type ConceptoCobroSolicitud = "reparacion" | "diagnostico";

/**
 * Cobro esperado de una solicitud, o `null` si no hay nada que cobrar ahora:
 * - la reparación, en `lista` con presupuesto aceptado (`finalAmount`, con X ya
 *   descontada);
 * - el diagnóstico, en `rechazada` o `expirada` (`diagnosticFee`).
 * Un importe de 0 € no es un cobro.
 */
export function cobroEsperadoSolicitud(
  solicitud: DatosCobroSolicitud,
): { concepto: ConceptoCobroSolicitud; importe: number } | null {
  const { quote } = solicitud;

  if (solicitud.paidAt !== null || !quote) {
    return null;
  }

  if (
    solicitud.status === "lista" &&
    quote.status === "aceptado" &&
    (quote.finalAmount ?? 0) > 0
  ) {
    return { concepto: "reparacion", importe: quote.finalAmount as number };
  }

  if (
    (solicitud.status === "rechazada" || solicitud.status === "expirada") &&
    quote.diagnosticFee > 0
  ) {
    return { concepto: "diagnostico", importe: quote.diagnosticFee };
  }

  return null;
}

/**
 * Entregar exige el cobro solo si hay algo que cobrar: presupuesto aceptado con
 * importe final > 0. Con `finalAmount = 0` la reparación se entrega sin pago.
 */
export function exigeCobroParaEntregar(quote: PresupuestoCobro | null): boolean {
  return quote?.status === "aceptado" && (quote.finalAmount ?? 0) > 0;
}

export function importesIguales(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

export type MotivoImporteInvalido = "importe-no-permitido" | "motivo-obligatorio";

/**
 * El importe por defecto es el esperado. Solo `admin` puede cobrar otro, y
 * entonces el motivo (la nota) es obligatorio.
 */
export function validarImporteCobro(datos: {
  esperado: number;
  importe: number;
  nota: string | null;
  esAdmin: boolean;
}): { ok: true } | { ok: false; motivo: MotivoImporteInvalido } {
  if (importesIguales(datos.importe, datos.esperado)) {
    return { ok: true };
  }

  if (!datos.esAdmin) {
    return { ok: false, motivo: "importe-no-permitido" };
  }

  if ((datos.nota?.trim().length ?? 0) < MIN_MOTIVO_AJUSTE) {
    return { ok: false, motivo: "motivo-obligatorio" };
  }

  return { ok: true };
}

/** Resumen del cobro que ve el staff en los detalles. */
export type CobroRegistrado = {
  paidAt: Date;
  paidAmount: number;
  paymentMethod: string | null;
  paidByName: string | null;
  paymentNote: string | null;
};
