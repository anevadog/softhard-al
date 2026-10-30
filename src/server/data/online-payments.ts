import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { PaymentSessionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { precioDesdeCentimos } from "@/lib/orders";
import { cobroEsperadoPedido, cobroEsperadoSolicitud } from "@/lib/payments";
import { aCentimos } from "@/lib/vat";
import { bloquearEntidadEnTx } from "@/server/data/invoices";
import {
  cobrarPedidoEnTx,
  cobrarSolicitudEnTx,
  type CamposCobro,
} from "@/server/data/payments";
import { obtenerPaymentProvider, type PaymentProvider } from "@/server/providers/payments";

/**
 * Pasarela de pago (5.3): un canal más de cobro, junto al registro manual de
 * 4.0. La fuente de verdad del cobro son los campos de la entidad; la
 * `PaymentSession` guarda el rastro de cada intento (idempotencia y
 * reembolsos). Los importes se calculan siempre en el servidor.
 */

type Tx = Prisma.TransactionClient;

export type EntidadPago = { tipo: "pedido"; id: string } | { tipo: "solicitud"; id: string };

const rutaEntidad = (entidad: EntidadPago) =>
  entidad.tipo === "pedido" ? `/app/pedidos/${entidad.id}` : `/app/solicitudes/${entidad.id}`;

/**
 * Importe que se puede cobrar AHORA por la pasarela, en céntimos, o `null`:
 * pedido pendiente sin cobrar y no vencido (`Order.total`); reparación en
 * `lista` con presupuesto aceptado e importe > 0 (`finalAmount`). El
 * diagnóstico no se paga online en esta fase.
 */
async function importePagableEnTx(
  tx: Tx,
  entidad: EntidadPago,
  ahora: Date,
  clienteId?: string,
): Promise<number | null | "no-existe"> {
  if (entidad.tipo === "pedido") {
    const pedido = await tx.order.findFirst({
      where: { id: entidad.id, ...(clienteId ? { userId: clienteId } : {}) },
      select: { status: true, total: true, expiresAt: true, paidAt: true },
    });

    if (!pedido) return "no-existe";

    const esperado = cobroEsperadoPedido({ ...pedido, total: Number(pedido.total) }, ahora);

    return esperado === null ? null : aCentimos(esperado);
  }

  const solicitud = await tx.serviceRequest.findFirst({
    where: { id: entidad.id, ...(clienteId ? { clientId: clienteId } : {}) },
    select: {
      status: true,
      paidAt: true,
      quote: { select: { status: true, finalAmount: true, diagnosticFee: true } },
    },
  });

  if (!solicitud) return "no-existe";

  const esperado = cobroEsperadoSolicitud({
    status: solicitud.status,
    paidAt: solicitud.paidAt,
    quote: solicitud.quote
      ? {
          status: solicitud.quote.status,
          finalAmount: solicitud.quote.finalAmount === null ? null : Number(solicitud.quote.finalAmount),
          diagnosticFee: Number(solicitud.quote.diagnosticFee),
        }
      : null,
  });

  return esperado?.concepto === "reparacion" ? aCentimos(esperado.importe) : null;
}

/** ¿Puede el cliente pagar ahora esta entidad por la pasarela? (para la UI) */
export async function puedePagarOnline(entidad: EntidadPago, clienteId: string): Promise<boolean> {
  const importe = await importePagableEnTx(prisma, entidad, new Date(), clienteId);

  return typeof importe === "number" && importe > 0;
}

export type ResultadoIniciarPago =
  | { ok: true; urlPago: string }
  | { ok: false; motivo: "no-existe" | "no-pagable" };

/**
 * Crea una sesión de pago para el cliente dueño de la entidad. Ajena o
 * inexistente → `no-existe` (sin distinguirlas). Cada intento es una sesión
 * nueva; las abandonadas quedan como rastro.
 */
export async function iniciarPago(datos: {
  entidad: EntidadPago;
  clienteId: string;
  provider?: PaymentProvider;
}): Promise<ResultadoIniciarPago> {
  const provider = datos.provider ?? obtenerPaymentProvider();
  const importe = await importePagableEnTx(prisma, datos.entidad, new Date(), datos.clienteId);

  if (importe === "no-existe") {
    return { ok: false, motivo: "no-existe" };
  }

  if (importe === null || importe <= 0) {
    return { ok: false, motivo: "no-pagable" };
  }

  const id = randomUUID();
  const returnPath = rutaEntidad(datos.entidad);
  const sesion = await provider.crearSesion({ importeCentimos: importe, referencia: id, urlRetorno: returnPath });

  await prisma.paymentSession.create({
    data: {
      id,
      provider: provider.nombre,
      providerRef: sesion.id,
      orderId: datos.entidad.tipo === "pedido" ? datos.entidad.id : null,
      requestId: datos.entidad.tipo === "solicitud" ? datos.entidad.id : null,
      customerId: datos.clienteId,
      amountCentimos: importe,
      returnPath,
    },
  });

  return { ok: true, urlPago: sesion.urlPago };
}

export type EventoPago = {
  /** Identificador de la sesión en el proveedor. */
  referencia: string;
  resultado: "pagado" | "fallido" | "abandonado";
};

export type ResultadoConfirmarPago = {
  estado: PaymentSessionStatus;
  returnPath: string;
};

const MOTIVO_REEMBOLSO =
  "El pago llegó cuando ya no se podía cobrar (caducado, cancelado, ya cobrado o importe distinto).";

/**
 * Punto de entrada único de la pasarela: hoy lo llama la página mock y mañana
 * el webhook. Idempotente por referencia: si la sesión ya no está `pendiente`,
 * no hace nada y devuelve su estado.
 *
 * Con "pagado", en una sola transacción y comprobando antes de escribir: se
 * bloquean la entidad y la sesión (`FOR UPDATE`, en ese orden, el mismo para
 * todos), se recalcula el importe esperado y, si cuadra, se registra el cobro
 * con su factura (el mismo condicional sobre `paidAt` nulo que el registro
 * manual) y la sesión pasa a `completada`. Si la entidad ya no se puede cobrar
 * (caducada, cancelada, ya cobrada) o el importe no coincide, la sesión pasa a
 * `reembolsada` y, al confirmarse, se llama a la pasarela.
 */
export async function confirmarPago(
  evento: EventoPago,
  provider: PaymentProvider = obtenerPaymentProvider(),
): Promise<ResultadoConfirmarPago | null> {
  const sesion = await prisma.paymentSession.findUnique({ where: { providerRef: evento.referencia } });

  if (!sesion) {
    return null;
  }

  const actual = async (): Promise<ResultadoConfirmarPago> => {
    const fila = await prisma.paymentSession.findUniqueOrThrow({
      where: { id: sesion.id },
      select: { status: true },
    });

    return { estado: fila.status, returnPath: sesion.returnPath };
  };

  if (sesion.status !== "pendiente") {
    return { estado: sesion.status, returnPath: sesion.returnPath };
  }

  if (evento.resultado !== "pagado") {
    await prisma.paymentSession.updateMany({
      where: { id: sesion.id, status: "pendiente" },
      data: { status: evento.resultado === "fallido" ? "fallida" : "abandonada" },
    });

    return actual();
  }

  const entidad: EntidadPago = sesion.orderId
    ? { tipo: "pedido", id: sesion.orderId }
    : { tipo: "solicitud", id: sesion.requestId as string };
  const ahora = new Date();

  const desenlace = await prisma.$transaction(async (tx) => {
    await bloquearEntidadEnTx(tx, entidad);
    const [bloqueada] = await tx.$queryRaw<{ status: PaymentSessionStatus }[]>`
      SELECT "status" FROM "payment_sessions" WHERE "id" = ${sesion.id} FOR UPDATE`;

    // Otra confirmación de la misma referencia ya la procesó.
    if (bloqueada?.status !== "pendiente") {
      return "nada" as const;
    }

    const esperado = await importePagableEnTx(tx, entidad, ahora);
    const campos: CamposCobro = {
      paidAt: ahora,
      paidAmount: precioDesdeCentimos(sesion.amountCentimos),
      paymentMethod: "tarjeta_online",
      paidById: null,
      paymentNote: null,
    };
    // Con la entidad bloqueada y el importe comprobado, el cobro condicional
    // solo puede fallar si algo inesperado cambió la fila: se reembolsa igual.
    const cobrado =
      esperado === sesion.amountCentimos &&
      (entidad.tipo === "pedido"
        ? await cobrarPedidoEnTx(tx, entidad.id, campos)
        : await cobrarSolicitudEnTx(tx, { id: entidad.id, estado: "lista", concepto: "reparacion", campos }));

    await tx.paymentSession.update({
      where: { id: sesion.id },
      data: cobrado
        ? { status: "completada", completedAt: ahora }
        : { status: "reembolsada", refundedAt: ahora, refundReason: MOTIVO_REEMBOLSO },
    });

    return cobrado ? ("cobrado" as const) : ("reembolsar" as const);
  });

  if (desenlace === "reembolsar") {
    await ejecutarReembolsos([sesion.providerRef], provider);
  }

  return actual();
}

const MOTIVO_CANCELACION = "Pedido cancelado por el staff tras emitir la rectificativa.";

/**
 * En la cancelación de un pedido cobrado por pasarela: marca sus sesiones
 * `completada` como `reembolsada` dentro de la transacción de la cancelación y
 * devuelve sus referencias, para llamar a `reembolsar` cuando se confirme. Los
 * campos de cobro del pedido no se tocan.
 */
export async function marcarReembolsoPorCancelacionEnTx(tx: Tx, orderId: string): Promise<string[]> {
  const sesiones = await tx.paymentSession.findMany({
    where: { orderId, status: "completada" },
    select: { id: true, providerRef: true },
  });

  if (sesiones.length === 0) {
    return [];
  }

  await tx.paymentSession.updateMany({
    where: { id: { in: sesiones.map((s) => s.id) }, status: "completada" },
    data: { status: "reembolsada", refundedAt: new Date(), refundReason: MOTIVO_CANCELACION },
  });

  return sesiones.map((s) => s.providerRef);
}

/** Llama a la pasarela tras confirmar la cancelación; un fallo se registra. */
export async function ejecutarReembolsos(
  referencias: readonly string[],
  provider: PaymentProvider = obtenerPaymentProvider(),
): Promise<void> {
  for (const referencia of referencias) {
    try {
      await provider.reembolsar(referencia);
    } catch (error) {
      console.error(`Reembolso de ${referencia} pendiente de reintentar en la pasarela:`, error);
    }
  }
}

export type SesionMock = {
  id: string;
  providerRef: string;
  status: PaymentSessionStatus;
  importeCentimos: number;
  concepto: string;
  returnPath: string;
};

/** Sesión para la página mock, filtrada por el cliente dueño (ajena → null). */
export async function obtenerSesionMock(id: string, clienteId: string): Promise<SesionMock | null> {
  const sesion = await prisma.paymentSession.findFirst({
    where: { id, customerId: clienteId, provider: "mock" },
    select: {
      id: true,
      providerRef: true,
      status: true,
      amountCentimos: true,
      returnPath: true,
      orderId: true,
      request: { select: { equipmentType: true, brand: true, model: true } },
    },
  });

  if (!sesion) {
    return null;
  }

  return {
    id: sesion.id,
    providerRef: sesion.providerRef,
    status: sesion.status,
    importeCentimos: sesion.amountCentimos,
    concepto: sesion.orderId
      ? `Pedido ${sesion.orderId.slice(0, 8).toUpperCase()}`
      : `Reparación ${sesion.request?.brand ?? ""} ${sesion.request?.model ?? ""}`.trim(),
    returnPath: sesion.returnPath,
  };
}
