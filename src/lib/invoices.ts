import type {
  InvoiceConcept,
  InvoiceKind,
  InvoiceMode,
  InvoiceSeries,
  OrderStatus,
  ServiceStatus,
} from "@/generated/prisma/enums";
import { CONTACT } from "@/lib/site-content";
import { desglosarTotal, sumarDesgloses, type Desglose } from "@/lib/vat";

/** Emisor ficticio de la demo: se copia en cada factura al emitirla. */
export const EMISOR = {
  name: "SoftHard A&L, S.L. (demo)",
  taxId: "B00000000",
  address: CONTACT.addressLines.join(", "),
  email: CONTACT.email,
} as const;

export const LEYENDA_FACTURA = "Factura simulada — sin validez fiscal";

export const MIN_MOTIVO_RECTIFICATIVA = 5;
export const MAX_MOTIVO_RECTIFICATIVA = 500;
export const MIN_MOTIVO_REEMISION = 10;
export const MAX_MOTIVO_REEMISION = 200;

export const INVOICE_SERIES_LABELS: Record<InvoiceSeries, string> = {
  FAC: "Ordinaria",
  RECT: "Rectificativa",
  MIG: "Retroactiva",
};

export const INVOICE_CONCEPT_LABELS: Record<InvoiceConcept, string> = {
  venta: "Venta",
  reparacion: "Reparación",
  diagnostico: "Diagnóstico",
};

export const INVOICE_MODE_LABELS: Record<InvoiceMode, string> = {
  simplificada: "Simplificada",
  completa: "Completa",
};

/** `<SERIE>-YYYY-NNNN`; a partir de 9999 el número sigue creciendo. */
export function codigoFactura(serie: InvoiceSeries, anio: number, numero: number): string {
  return `${serie}-${anio}-${String(numero).padStart(4, "0")}`;
}

const anioMadrid = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  year: "numeric",
});

/** La numeración se reinicia cada año natural en Europe/Madrid. */
export function anioFiscal(fecha: Date): number {
  return Number(anioMadrid.format(fecha));
}

/** Con NIF la factura es completa; sin él, simplificada. */
export function modalidadFactura(nif: string | null): InvoiceMode {
  return nif ? "completa" : "simplificada";
}

/** Línea antes del desglose: PVP unitario con IVA incluido, en céntimos. */
export type LineaFactura = {
  description: string;
  quantity: number;
  unitPriceCentimos: number;
};

export type LineaDesglosada = LineaFactura & Desglose;

export function lineasPedido(
  items: readonly { productName: string; quantity: number; priceCentimos: number }[],
): LineaFactura[] {
  return items.map((item) => ({
    description: item.productName,
    quantity: item.quantity,
    unitPriceCentimos: item.priceCentimos,
  }));
}

/** Reparación aceptada: presupuesto menos el diagnóstico ya incluido (X). */
export function lineasReparacion(datos: {
  equipo: string;
  brand: string;
  model: string;
  budgetCentimos: number;
  diagnosticFeeCentimos: number;
}): LineaFactura[] {
  return [
    {
      description: `Reparación de ${datos.equipo} ${datos.brand} ${datos.model}`.trim(),
      quantity: 1,
      unitPriceCentimos: datos.budgetCentimos,
    },
    {
      description: "Descuento diagnóstico",
      quantity: 1,
      unitPriceCentimos: -datos.diagnosticFeeCentimos,
    },
  ];
}

export function lineasDiagnostico(diagnosticFeeCentimos: number): LineaFactura[] {
  return [{ description: "Diagnóstico", quantity: 1, unitPriceCentimos: diagnosticFeeCentimos }];
}

function totalLineas(lineas: readonly LineaFactura[]): number {
  return lineas.reduce((suma, linea) => suma + linea.unitPriceCentimos * linea.quantity, 0);
}

/**
 * Si se cobró un importe distinto del esperado, una línea "Ajuste de importe"
 * por la diferencia hace que el total de la factura sea lo cobrado.
 */
export function conAjuste(
  lineas: readonly LineaFactura[],
  cobradoCentimos: number,
): LineaFactura[] {
  const diferencia = cobradoCentimos - totalLineas(lineas);

  return diferencia === 0
    ? [...lineas]
    : [...lineas, { description: "Ajuste de importe", quantity: 1, unitPriceCentimos: diferencia }];
}

/** Rectificativa total: las mismas líneas con signo negativo. */
export function lineasRectificativa(lineas: readonly LineaFactura[]): LineaFactura[] {
  return lineas.map((linea) => ({
    ...linea,
    unitPriceCentimos: -linea.unitPriceCentimos,
  }));
}

/** Desglose línea a línea y totales de la factura (suma de las líneas). */
export function desglosarFactura(
  lineas: readonly LineaFactura[],
  tipo: number,
): { lineas: LineaDesglosada[]; totales: Desglose } {
  const desglosadas = lineas.map((linea) => ({
    ...linea,
    ...desglosarTotal(linea.unitPriceCentimos * linea.quantity, tipo),
  }));

  return { lineas: desglosadas, totales: sumarDesgloses(desglosadas) };
}

export type FacturaDeEntidad = {
  id: string;
  kind: InvoiceKind;
  rectifiesInvoiceId: string | null;
};

/**
 * Factura vigente de un pedido o solicitud: la ordinaria (FAC o MIG) que
 * ninguna rectificativa anula. Como mucho hay una.
 */
export function facturaVigente<T extends FacturaDeEntidad>(facturas: readonly T[]): T | null {
  const rectificadas = new Set(
    facturas.flatMap((factura) =>
      factura.kind === "rectificativa" && factura.rectifiesInvoiceId
        ? [factura.rectifiesInvoiceId]
        : [],
    ),
  );

  return (
    facturas.find(
      (factura) => factura.kind === "ordinaria" && !rectificadas.has(factura.id),
    ) ?? null
  );
}

const ESTADOS_SIN_REEMISION: readonly (OrderStatus | ServiceStatus)[] = [
  "cancelado",
  "rechazada",
  "expirada",
];

/**
 * "Emitir factura de nuevo": con cobro registrado, alguna factura ordinaria
 * ya rectificada y ninguna vigente, y la entidad no cancelada, rechazada ni
 * expirada (el diagnóstico queda cubierto por su factura rectificada).
 */
export function puedeReemitir(datos: {
  pagada: boolean;
  status: OrderStatus | ServiceStatus;
  facturas: readonly FacturaDeEntidad[];
}): boolean {
  return (
    datos.pagada &&
    !ESTADOS_SIN_REEMISION.includes(datos.status) &&
    datos.facturas.some((factura) => factura.kind === "ordinaria") &&
    facturaVigente(datos.facturas) === null
  );
}
