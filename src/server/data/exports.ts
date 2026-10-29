import { prisma } from "@/lib/db";
import { MAX_FILAS_EXPORTACION } from "@/lib/exports";
import type {
  FiltrosIngresos,
  FiltrosPedidos,
  FiltrosReparaciones,
} from "@/lib/validations/exports";

/**
 * Consultas de la exportación a CSV (4.2), solo para staff (el route handler
 * lo comprueba). Cada una pide una fila más que el tope: si llega, devuelve
 * `null` y el handler responde con un error en lugar de un fichero truncado.
 * La nota del cobro nunca se selecciona.
 */

function dentroDelTope<T>(filas: T[], tope: number): T[] | null {
  return filas.length > tope ? null : filas;
}

/** Una fila por factura (todas las series), por `issuedAt`: cuadra con el dashboard. */
export async function filasIngresos(filtros: FiltrosIngresos, tope = MAX_FILAS_EXPORTACION) {
  const filas = await prisma.invoice.findMany({
    where: {
      issuedAt: { gte: filtros.rango.inicio, lt: filtros.rango.fin },
      ...(filtros.concepto ? { concept: filtros.concepto } : {}),
      ...(filtros.serie ? { series: filtros.serie } : {}),
    },
    orderBy: [{ issuedAt: "asc" }, { code: "asc" }],
    take: tope + 1,
    select: {
      code: true,
      series: true,
      kind: true,
      isBackfill: true,
      concept: true,
      issuedAt: true,
      mode: true,
      customerName: true,
      customerEmail: true,
      baseTotal: true,
      vatTotal: true,
      total: true,
      rectifies: { select: { code: true } },
      replaces: { select: { code: true } },
    },
  });

  return dentroDelTope(filas, tope);
}

/** Una fila por línea de pedido, por fecha de creación del pedido. */
export async function filasPedidos(filtros: FiltrosPedidos, tope = MAX_FILAS_EXPORTACION) {
  const filas = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: filtros.rango.inicio, lt: filtros.rango.fin },
        ...(filtros.estado ? { status: filtros.estado } : {}),
      },
    },
    orderBy: [{ order: { createdAt: "asc" } }, { orderId: "asc" }, { id: "asc" }],
    take: tope + 1,
    select: {
      quantity: true,
      price: true,
      product: { select: { name: true } },
      order: {
        select: {
          id: true,
          createdAt: true,
          status: true,
          paidAt: true,
          paidAmount: true,
          paymentMethod: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  return dentroDelTope(filas, tope);
}

/** Una fila por solicitud, por fecha de entrada. */
export async function filasReparaciones(filtros: FiltrosReparaciones, tope = MAX_FILAS_EXPORTACION) {
  const filas = await prisma.serviceRequest.findMany({
    where: {
      createdAt: { gte: filtros.rango.inicio, lt: filtros.rango.fin },
      ...(filtros.estado ? { status: filtros.estado } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: tope + 1,
    select: {
      id: true,
      createdAt: true,
      lastActivityAt: true,
      status: true,
      equipmentType: true,
      brand: true,
      model: true,
      modality: true,
      paidAt: true,
      paidAmount: true,
      paymentMethod: true,
      assignee: { select: { name: true } },
      quote: { select: { budgetAmount: true, diagnosticFee: true, finalAmount: true } },
    },
  });

  return dentroDelTope(filas, tope);
}

export type FilaIngresosCsv = NonNullable<Awaited<ReturnType<typeof filasIngresos>>>[number];
export type FilaPedidosCsv = NonNullable<Awaited<ReturnType<typeof filasPedidos>>>[number];
export type FilaReparacionesCsv = NonNullable<Awaited<ReturnType<typeof filasReparaciones>>>[number];
