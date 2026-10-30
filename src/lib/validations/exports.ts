import { z } from "zod";

import { INVOICE_CONCEPT_LABELS, INVOICE_SERIES_LABELS } from "@/lib/invoices";
import {
  MAX_DIAS_EXPORTACION,
  diasDelRango,
  partesDia,
  rangoDesdeDias,
  type RangoExportacion,
} from "@/lib/exports";
import { ORDER_STATUSES } from "@/lib/orders";
import { SERVICE_STATUSES } from "@/lib/service-requests";
import type { InvoiceConcept, InvoiceSeries } from "@/generated/prisma/enums";

/**
 * Filtros de las exportaciones (query string). El rango es obligatorio: días
 * completos en Europe/Madrid, `hasta` incluido, como mucho 366 días.
 */

const dia = (campo: string) =>
  z
    .string({ error: `Indica la fecha ${campo}` })
    .trim()
    .refine((valor) => partesDia(valor) !== null, `La fecha ${campo} no es válida (AAAA-MM-DD)`);

/** Un parámetro vacío (`?estado=`) cuenta como ausente. */
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((valor) => (valor === "" ? undefined : valor), esquema.optional());

const RANGO = { desde: dia("de inicio"), hasta: dia("de fin") };

function validarRango(datos: { desde: string; hasta: string }, ctx: z.RefinementCtx) {
  const desde = partesDia(datos.desde);
  const hasta = partesDia(datos.hasta);
  if (!desde || !hasta) return;

  const dias = diasDelRango(desde, hasta);

  if (dias < 1) {
    ctx.addIssue({ code: "custom", path: ["hasta"], message: "La fecha de fin es anterior a la de inicio" });
  } else if (dias > MAX_DIAS_EXPORTACION) {
    ctx.addIssue({
      code: "custom",
      path: ["hasta"],
      message: `El rango no puede superar los ${MAX_DIAS_EXPORTACION} días`,
    });
  }
}

/** Añade los instantes del rango (ya validado) a los filtros. */
function conRango<T extends { desde: string; hasta: string }>(datos: T): T & { rango: RangoExportacion } {
  return { ...datos, rango: rangoDesdeDias(datos.desde, datos.hasta) as RangoExportacion };
}

const CONCEPTOS = Object.keys(INVOICE_CONCEPT_LABELS) as [InvoiceConcept, ...InvoiceConcept[]];
const SERIES = Object.keys(INVOICE_SERIES_LABELS) as [InvoiceSeries, ...InvoiceSeries[]];

export const filtrosIngresosSchema = z
  .object({
    ...RANGO,
    concepto: opcional(z.enum(CONCEPTOS, { error: "Concepto no válido" })),
    serie: opcional(z.enum(SERIES, { error: "Serie no válida" })),
  })
  .superRefine(validarRango)
  .transform(conRango);

export const filtrosPedidosSchema = z
  .object({ ...RANGO, estado: opcional(z.enum(ORDER_STATUSES, { error: "Estado de pedido no válido" })) })
  .superRefine(validarRango)
  .transform(conRango);

export const filtrosReparacionesSchema = z
  .object({
    ...RANGO,
    estado: opcional(z.enum(SERVICE_STATUSES, { error: "Estado de reparación no válido" })),
  })
  .superRefine(validarRango)
  .transform(conRango);

export type FiltrosIngresos = z.infer<typeof filtrosIngresosSchema>;
export type FiltrosPedidos = z.infer<typeof filtrosPedidosSchema>;
export type FiltrosReparaciones = z.infer<typeof filtrosReparacionesSchema>;
