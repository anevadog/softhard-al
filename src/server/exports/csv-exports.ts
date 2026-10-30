import type { z } from "zod";

import { entero, fecha, generarCsv, importe, texto, type Celda } from "@/lib/csv";
import { MAX_FILAS_EXPORTACION, nombreFicheroCsv } from "@/lib/exports";
import { INVOICE_CONCEPT_LABELS, INVOICE_MODE_LABELS } from "@/lib/invoices";
import { etiquetaEstadoPedido } from "@/lib/orders";
import { etiquetaMetodoPago } from "@/lib/payments";
import { EQUIPMENT_LABELS, MODALITY_LABELS, etiquetaEstado } from "@/lib/service-requests";
import { aCentimos } from "@/lib/vat";
import {
  filtrosIngresosSchema,
  filtrosPedidosSchema,
  filtrosReparacionesSchema,
} from "@/lib/validations/exports";
import { requerirStaff } from "@/server/authorization";
import {
  filasIngresos,
  filasPedidos,
  filasReparaciones,
  type FilaIngresosCsv,
  type FilaPedidosCsv,
  type FilaReparacionesCsv,
} from "@/server/data/exports";

/**
 * Route handlers de `/admin/exportar/*.csv` (4.2). Una descarga GET no encaja
 * en una Server Action; el middleware protege `/admin` y, además, cada handler
 * revalida el rol con `requerirStaff()`. Los importes son PVP con IVA incluido.
 */

const centimos = (valor: { toString(): string } | null | undefined) =>
  valor === null || valor === undefined ? null : aCentimos(Number(valor));

const siNo = (valor: boolean) => (valor ? "Sí" : "No");

function textoPlano(mensaje: string, status: number): Response {
  return new Response(mensaje, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

type Definicion<F extends { rango: { desde: string; hasta: string } }, R> = {
  base: string;
  esquema: z.ZodType<F>;
  consultar: (filtros: F) => Promise<R[] | null>;
  cabeceras: readonly string[];
  fila: (registro: R) => Celda[];
};

async function exportar<F extends { rango: { desde: string; hasta: string } }, R>(
  request: Request,
  definicion: Definicion<F, R>,
): Promise<Response> {
  await requerirStaff();

  const parametros = Object.fromEntries(new URL(request.url).searchParams);
  const filtros = definicion.esquema.safeParse(parametros);

  if (!filtros.success) {
    return textoPlano(filtros.error.issues[0]?.message ?? "Filtros no válidos", 400);
  }

  const registros = await definicion.consultar(filtros.data);

  if (!registros) {
    return textoPlano(
      `La exportación supera las ${MAX_FILAS_EXPORTACION} filas. Acota el rango de fechas.`,
      422,
    );
  }

  const csv = generarCsv(definicion.cabeceras, registros.map(definicion.fila));

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreFicheroCsv(definicion.base, filtros.data.rango)}"`,
      "Cache-Control": "no-store",
    },
  });
}

const INGRESOS: Definicion<z.infer<typeof filtrosIngresosSchema>, FilaIngresosCsv> = {
  base: "ingresos",
  esquema: filtrosIngresosSchema,
  consultar: (filtros) => filasIngresos(filtros),
  cabeceras: [
    "Número",
    "Tipo",
    "Retroactiva",
    "Rectifica a",
    "Sustituye a",
    "Concepto",
    "Fecha de emisión",
    "Cliente",
    "Email",
    "Modalidad",
    "Base imponible (€)",
    "IVA (€)",
    "Total (€, IVA incl.)",
  ],
  fila: (f) => [
    texto(f.code),
    texto(f.kind === "rectificativa" ? "Rectificativa" : "Ordinaria"),
    texto(siNo(f.isBackfill)),
    texto(f.rectifies?.code),
    texto(f.replaces?.code),
    texto(INVOICE_CONCEPT_LABELS[f.concept]),
    fecha(f.issuedAt),
    texto(f.customerName),
    texto(f.customerEmail),
    texto(INVOICE_MODE_LABELS[f.mode]),
    importe(centimos(f.baseTotal)),
    importe(centimos(f.vatTotal)),
    importe(centimos(f.total)),
  ],
};

const PEDIDOS: Definicion<z.infer<typeof filtrosPedidosSchema>, FilaPedidosCsv> = {
  base: "pedidos",
  esquema: filtrosPedidosSchema,
  consultar: (filtros) => filasPedidos(filtros),
  cabeceras: [
    "Pedido",
    "Fecha",
    "Estado",
    "Cliente",
    "Email",
    "Producto",
    "Cantidad",
    "PVP unitario (€, IVA incl.)",
    "Total línea (€, IVA incl.)",
    "Fecha de cobro",
    "Importe cobrado (€, IVA incl.)",
    "Método de pago",
  ],
  fila: (f) => {
    const unitario = aCentimos(Number(f.price));

    return [
      texto(f.order.id),
      fecha(f.order.createdAt),
      texto(etiquetaEstadoPedido(f.order.status)),
      texto(f.order.user.name),
      texto(f.order.user.email),
      texto(f.product.name),
      entero(f.quantity),
      importe(unitario),
      importe(unitario * f.quantity),
      fecha(f.order.paidAt),
      importe(centimos(f.order.paidAmount)),
      texto(f.order.paidAt ? etiquetaMetodoPago(f.order.paymentMethod) : null),
    ];
  },
};

const REPARACIONES: Definicion<z.infer<typeof filtrosReparacionesSchema>, FilaReparacionesCsv> = {
  base: "reparaciones",
  esquema: filtrosReparacionesSchema,
  consultar: (filtros) => filasReparaciones(filtros),
  cabeceras: [
    "Solicitud",
    "Fecha de entrada",
    "Última actividad",
    "Estado",
    "Equipo",
    "Modalidad",
    "Responsable",
    "Presupuesto (€, IVA incl.)",
    "Diagnóstico X (€, IVA incl.)",
    "Importe final (€, IVA incl.)",
    "Fecha de cobro",
    "Importe cobrado (€, IVA incl.)",
    "Método de pago",
  ],
  fila: (f) => [
    texto(f.id),
    fecha(f.createdAt),
    fecha(f.lastActivityAt),
    texto(etiquetaEstado(f.status)),
    texto(`${EQUIPMENT_LABELS[f.equipmentType]} · ${f.brand} ${f.model}`),
    texto(MODALITY_LABELS[f.modality]),
    texto(f.assignee?.name),
    importe(centimos(f.quote?.budgetAmount)),
    importe(centimos(f.quote?.diagnosticFee)),
    importe(centimos(f.quote?.finalAmount)),
    fecha(f.paidAt),
    importe(centimos(f.paidAmount)),
    texto(f.paidAt ? etiquetaMetodoPago(f.paymentMethod) : null),
  ],
};

export const exportarIngresos = (request: Request) => exportar(request, INGRESOS);
export const exportarPedidos = (request: Request) => exportar(request, PEDIDOS);
export const exportarReparaciones = (request: Request) => exportar(request, REPARACIONES);
