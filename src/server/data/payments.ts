import type { Prisma } from "@/generated/prisma/client";
import type { ServiceStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { pedidoCaducado, precioDesdeCentimos } from "@/lib/orders";
import {
  cobroEsperadoPedido,
  cobroEsperadoSolicitud,
  validarImporteCobro,
  type CobroRegistrado,
  type ConceptoCobroSolicitud,
  type MetodoPagoManual,
  type MotivoImporteInvalido,
} from "@/lib/payments";
import { emitirFacturaDeCobroEnTx } from "@/server/data/invoices";

export type DatosRegistroCobro = {
  id: string;
  importe: number;
  metodo: MetodoPagoManual;
  nota: string | null;
  staff: { id: string; role: "encargado" | "admin" };
};

export type MotivoCobroRechazado =
  | MotivoImporteInvalido
  | "no-existe"
  | "ya-cobrado"
  | "caducado"
  | "no-cobrable"
  | "conflicto";

export type ResultadoRegistroCobro =
  | { ok: true }
  | { ok: false; motivo: MotivoCobroRechazado };

/** Campos a seleccionar para mostrar un cobro en el panel. */
export const SELECT_COBRO = {
  paidAt: true,
  paidAmount: true,
  paymentMethod: true,
  paymentNote: true,
  paidBy: { select: { name: true } },
} as const;

/** Convierte la fila con `SELECT_COBRO` en el resumen del cobro (o `null`). */
export function cobroDesdeFila(fila: {
  paidAt: Date | null;
  paidAmount: { toString(): string } | null;
  paymentMethod: string | null;
  paymentNote: string | null;
  paidBy: { name: string } | null;
}): CobroRegistrado | null {
  if (fila.paidAt === null || fila.paidAmount === null) {
    return null;
  }

  return {
    paidAt: fila.paidAt,
    paidAmount: Number(fila.paidAmount),
    paymentMethod: fila.paymentMethod,
    paidByName: fila.paidBy?.name ?? null,
    paymentNote: fila.paymentNote,
  };
}

function importeDecimal(importe: number): string {
  return precioDesdeCentimos(Math.round(importe * 100));
}

/** Campos de cobro de la entidad; los comparten el registro manual y la pasarela. */
export type CamposCobro = {
  paidAt: Date;
  paidAmount: string;
  paymentMethod: string;
  paidById: string | null;
  paymentNote: string | null;
};

function camposCobro(datos: DatosRegistroCobro, ahora: Date): CamposCobro {
  return {
    paidAt: ahora,
    paidAmount: importeDecimal(datos.importe),
    paymentMethod: datos.metodo,
    paidById: datos.staff.id,
    paymentNote: datos.nota,
  };
}

/**
 * Cobro de un pedido dentro de una transacción ya abierta: el `updateMany`
 * condicional (pendiente, sin cobro y no vencido) pasa el pedido a `pagado` y
 * la factura se emite en la misma transacción. `false` si otra operación ganó.
 */
export async function cobrarPedidoEnTx(
  tx: Prisma.TransactionClient,
  id: string,
  campos: CamposCobro,
): Promise<boolean> {
  const actualizado = await tx.order.updateMany({
    where: {
      id,
      status: "pendiente",
      paidAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: campos.paidAt } }],
    },
    data: { status: "pagado", ...campos },
  });

  if (actualizado.count === 0) {
    return false;
  }

  await emitirFacturaDeCobroEnTx(tx, { tipo: "pedido", id }, campos.paidAt);

  return true;
}

/**
 * Cobro de una solicitud dentro de una transacción ya abierta, condicionado al
 * estado que se vio y a `paidAt` nulo; no cambia el estado. La factura se
 * emite en la misma transacción. `false` si otra operación ganó.
 */
export async function cobrarSolicitudEnTx(
  tx: Prisma.TransactionClient,
  datos: { id: string; estado: ServiceStatus; concepto: ConceptoCobroSolicitud; campos: CamposCobro },
): Promise<boolean> {
  const actualizado = await tx.serviceRequest.updateMany({
    where: { id: datos.id, status: datos.estado, paidAt: null },
    data: {
      ...datos.campos,
      ...(datos.concepto === "reparacion" ? { lastActivityAt: datos.campos.paidAt } : {}),
    },
  });

  if (actualizado.count === 0) {
    return false;
  }

  await emitirFacturaDeCobroEnTx(tx, { tipo: "solicitud", id: datos.id }, datos.campos.paidAt);

  return true;
}

/**
 * Registro manual del cobro de un pedido. Es la única forma de pasar un pedido
 * a `pagado`: el `updateMany` condicional (pendiente, sin cobro y no vencido)
 * resuelve las carreras con otro registro, una cancelación o la caducidad. La
 * factura se emite en la misma transacción.
 */
export async function registrarCobroPedido(
  datos: DatosRegistroCobro,
): Promise<ResultadoRegistroCobro> {
  const ahora = new Date();
  const pedido = await prisma.order.findUnique({
    where: { id: datos.id },
    select: { status: true, total: true, expiresAt: true, paidAt: true },
  });

  if (!pedido) {
    return { ok: false, motivo: "no-existe" };
  }

  const motivoPrevio = motivoPedidoNoCobrable(pedido, ahora);
  const esperado = cobroEsperadoPedido({ ...pedido, total: Number(pedido.total) }, ahora);

  if (motivoPrevio || esperado === null) {
    return { ok: false, motivo: motivoPrevio ?? "no-cobrable" };
  }

  const importe = validarImporteCobro({
    esperado,
    importe: datos.importe,
    nota: datos.nota,
    esAdmin: datos.staff.role === "admin",
  });

  if (!importe.ok) {
    return importe;
  }

  const cobrado = await prisma.$transaction((tx) =>
    cobrarPedidoEnTx(tx, datos.id, camposCobro(datos, ahora)),
  );

  if (cobrado) {
    return { ok: true };
  }

  const actual = await prisma.order.findUnique({
    where: { id: datos.id },
    select: { status: true, expiresAt: true, paidAt: true },
  });

  return {
    ok: false,
    motivo: (actual && motivoPedidoNoCobrable(actual, ahora)) ?? "conflicto",
  };
}

function motivoPedidoNoCobrable(
  pedido: { status: string; expiresAt: Date | null; paidAt: Date | null },
  ahora: Date,
): MotivoCobroRechazado | null {
  if (pedido.paidAt !== null) {
    return "ya-cobrado";
  }

  if (
    pedido.status === "caducado" ||
    (pedido.status === "pendiente" && pedidoCaducado(pedido.expiresAt, ahora))
  ) {
    return "caducado";
  }

  return pedido.status === "pendiente" ? null : "no-cobrable";
}

/**
 * Registro manual del cobro de una solicitud: la reparación en `lista` o el
 * diagnóstico en `rechazada`/`expirada`. No cambia el estado; el condicional
 * sobre estado y `paidAt` evita cobrar dos veces o cobrar algo que acaba de
 * cambiar. Cobrar una reparación en curso cuenta como actividad. La factura se
 * emite en la misma transacción.
 */
export async function registrarCobroSolicitud(
  datos: DatosRegistroCobro,
): Promise<ResultadoRegistroCobro> {
  const ahora = new Date();
  const solicitud = await prisma.serviceRequest.findUnique({
    where: { id: datos.id },
    select: {
      status: true,
      paidAt: true,
      quote: { select: { status: true, finalAmount: true, diagnosticFee: true } },
    },
  });

  if (!solicitud) {
    return { ok: false, motivo: "no-existe" };
  }

  if (solicitud.paidAt !== null) {
    return { ok: false, motivo: "ya-cobrado" };
  }

  const esperado = cobroEsperadoSolicitud({
    status: solicitud.status,
    paidAt: solicitud.paidAt,
    quote: solicitud.quote
      ? {
          status: solicitud.quote.status,
          finalAmount:
            solicitud.quote.finalAmount === null ? null : Number(solicitud.quote.finalAmount),
          diagnosticFee: Number(solicitud.quote.diagnosticFee),
        }
      : null,
  });

  if (!esperado) {
    return { ok: false, motivo: "no-cobrable" };
  }

  const importe = validarImporteCobro({
    esperado: esperado.importe,
    importe: datos.importe,
    nota: datos.nota,
    esAdmin: datos.staff.role === "admin",
  });

  if (!importe.ok) {
    return importe;
  }

  const estado: ServiceStatus = solicitud.status;
  const cobrado = await prisma.$transaction((tx) =>
    cobrarSolicitudEnTx(tx, {
      id: datos.id,
      estado,
      concepto: esperado.concepto,
      campos: camposCobro(datos, ahora),
    }),
  );

  if (cobrado) {
    return { ok: true };
  }

  const actual = await prisma.serviceRequest.findUnique({
    where: { id: datos.id },
    select: { paidAt: true },
  });

  return { ok: false, motivo: actual?.paidAt ? "ya-cobrado" : "conflicto" };
}
