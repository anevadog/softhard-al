import type { InvoiceConcept, InvoiceSeries } from "@/generated/prisma/enums";
import type { FilaIngresos, PeriodoDashboard } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { aCentimos } from "@/lib/vat";
import { WHERE_PENDIENTE_COBRO } from "@/server/data/admin-requests";

/**
 * Consultas del dashboard (4.1). Todo se agrega en PostgreSQL: nunca se cargan
 * las facturas ni los pedidos uno a uno.
 */

/**
 * Ingresos del periodo por mes (Europe/Madrid), concepto y serie. Las columnas
 * son `timestamp` sin zona con instantes UTC: los límites se pasan como
 * `timestamptz` y se convierten a UTC, sin depender del `TimeZone` de la sesión.
 */
export async function obtenerFilasIngresos(periodo: PeriodoDashboard): Promise<FilaIngresos[]> {
  const filas = await prisma.$queryRaw<
    { mes: string; concept: InvoiceConcept; series: InvoiceSeries; total: string; facturas: number }[]
  >`
    SELECT
      to_char(("issuedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS "mes",
      "concept",
      "series",
      SUM("total")::text AS "total",
      COUNT(*)::int AS "facturas"
    FROM "invoices"
    WHERE "issuedAt" >= (${periodo.inicio.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      AND "issuedAt" < (${periodo.fin.toISOString()}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1, 2, 3`;

  return filas.map((fila) => ({
    mes: fila.mes,
    concept: fila.concept,
    series: fila.series,
    totalCentimos: aCentimos(Number(fila.total)),
    facturas: fila.facturas,
  }));
}

/**
 * Pedidos perdidos del periodo, imputados por `updatedAt`: `cancelado` es una
 * decisión humana y `caducado`, impago (lo pone el sistema).
 */
export async function contarPedidosPerdidos(
  periodo: PeriodoDashboard,
): Promise<{ cancelados: number; caducados: number }> {
  const grupos = await prisma.order.groupBy({
    by: ["status"],
    where: {
      status: { in: ["cancelado", "caducado"] },
      updatedAt: { gte: periodo.inicio, lt: periodo.fin },
    },
    _count: true,
  });
  const cuenta = (estado: string) => grupos.find((g) => g.status === estado)?._count ?? 0;

  return { cancelados: cuenta("cancelado"), caducados: cuenta("caducado") };
}

/** Reparaciones listas sin cobrar: número e importe esperado (`finalAmount`). */
export async function resumirPendientesCobro(): Promise<{ total: number; importeCentimos: number }> {
  const agregado = await prisma.quote.aggregate({
    where: { request: { is: WHERE_PENDIENTE_COBRO } },
    _count: true,
    _sum: { finalAmount: true },
  });

  return {
    total: agregado._count,
    importeCentimos: aCentimos(Number(agregado._sum.finalAmount ?? 0)),
  };
}
