import type { Prisma } from "@/generated/prisma/client";
import type {
  InvoiceConcept,
  InvoiceKind,
  InvoiceMode,
  InvoiceSeries,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  EMISOR,
  anioFiscal,
  codigoFactura,
  conAjuste,
  desglosarFactura,
  facturaVigente,
  lineasDiagnostico,
  lineasPedido,
  lineasRectificativa,
  lineasReparacion,
  modalidadFactura,
  puedeReemitir,
  type LineaFactura,
} from "@/lib/invoices";
import { precioDesdeCentimos } from "@/lib/orders";
import { EQUIPMENT_LABELS } from "@/lib/service-requests";
import { aCentimos } from "@/lib/vat";

type Tx = Prisma.TransactionClient;

export type EntidadFacturable =
  | { tipo: "pedido"; id: string }
  | { tipo: "solicitud"; id: string };

const TIPO_IVA_DEFECTO = 21;

const dinero = (centimos: number) => precioDesdeCentimos(centimos);

/**
 * Siguiente número de la serie y año. El upsert atómico bloquea la fila del
 * contador hasta el final de la transacción: si la factura no llega a crearse,
 * el contador se revierte con ella y no quedan huecos.
 */
async function siguienteNumero(tx: Tx, serie: InvoiceSeries, anio: number): Promise<number> {
  const [fila] = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "invoice_counters" ("series", "year", "lastNumber")
    VALUES (${serie}::"InvoiceSeries", ${anio}, 1)
    ON CONFLICT ("series", "year")
    DO UPDATE SET "lastNumber" = "invoice_counters"."lastNumber" + 1
    RETURNING "lastNumber"`;

  return fila.lastNumber;
}

async function tipoIvaVigente(tx: Tx): Promise<number> {
  const config = await tx.config.findUnique({ where: { id: 1 }, select: { vatRate: true } });

  return config ? Number(config.vatRate) : TIPO_IVA_DEFECTO;
}

type Cliente = {
  id: string;
  name: string;
  email: string;
  nif: string | null;
  address: string | null;
};

type DatosNuevaFactura = {
  serie: InvoiceSeries;
  kind: InvoiceKind;
  concept: InvoiceConcept;
  issuedAt: Date;
  entidad: EntidadFacturable;
  cliente: Cliente;
  mode?: InvoiceMode;
  lineas: readonly LineaFactura[];
  vatRate: number;
  paymentMethod: string | null;
  rectifiesInvoiceId?: string;
  reason?: string;
  replacesInvoiceId?: string;
  reissueReason?: string;
  issuedById?: string | null;
  id?: string;
};

/** Crea la factura con su número, desglose y snapshot de emisor y cliente. */
export async function crearFacturaEnTx(
  tx: Tx,
  datos: DatosNuevaFactura,
): Promise<{ id: string; code: string }> {
  const anio = anioFiscal(datos.issuedAt);
  const numero = await siguienteNumero(tx, datos.serie, anio);
  const { lineas, totales } = desglosarFactura(datos.lineas, datos.vatRate);
  const mode = datos.mode ?? modalidadFactura(datos.cliente.nif);

  return tx.invoice.create({
    data: {
      ...(datos.id ? { id: datos.id } : {}),
      series: datos.serie,
      year: anio,
      number: numero,
      code: codigoFactura(datos.serie, anio, numero),
      kind: datos.kind,
      concept: datos.concept,
      mode,
      issuedAt: datos.issuedAt,
      isBackfill: datos.serie === "MIG",
      orderId: datos.entidad.tipo === "pedido" ? datos.entidad.id : null,
      requestId: datos.entidad.tipo === "solicitud" ? datos.entidad.id : null,
      rectifiesInvoiceId: datos.rectifiesInvoiceId ?? null,
      reason: datos.reason ?? null,
      replacesInvoiceId: datos.replacesInvoiceId ?? null,
      reissueReason: datos.reissueReason ?? null,
      issuedById: datos.issuedById ?? null,
      customerId: datos.cliente.id,
      customerName: datos.cliente.name,
      customerEmail: datos.cliente.email,
      customerTaxId: mode === "completa" ? datos.cliente.nif : null,
      customerAddress: mode === "completa" ? datos.cliente.address : null,
      issuerName: EMISOR.name,
      issuerTaxId: EMISOR.taxId,
      issuerAddress: EMISOR.address,
      issuerEmail: EMISOR.email,
      vatRate: datos.vatRate.toFixed(2),
      baseTotal: dinero(totales.baseCentimos),
      vatTotal: dinero(totales.ivaCentimos),
      total: dinero(totales.totalCentimos),
      paymentMethod: datos.paymentMethod,
      lines: {
        create: lineas.map((linea, posicion) => ({
          position: posicion + 1,
          description: linea.description,
          quantity: linea.quantity,
          unitPrice: dinero(linea.unitPriceCentimos),
          lineTotal: dinero(linea.totalCentimos),
          lineBase: dinero(linea.baseCentimos),
          lineVat: dinero(linea.ivaCentimos),
        })),
      },
    },
    select: { id: true, code: true },
  });
}

type ContenidoFactura = {
  concept: InvoiceConcept;
  lineas: LineaFactura[];
  cliente: Cliente;
  paymentMethod: string | null;
};

/**
 * Líneas, concepto y cliente de una entidad cobrada, con los datos actuales.
 * `null` si no hay cobro o el importe cobrado es 0 (no se factura).
 */
export async function contenidoFacturaEnTx(
  tx: Tx,
  entidad: EntidadFacturable,
): Promise<ContenidoFactura | null> {
  if (entidad.tipo === "pedido") {
    const pedido = await tx.order.findUnique({
      where: { id: entidad.id },
      select: {
        paidAmount: true,
        paymentMethod: true,
        user: { select: { id: true, name: true, email: true, nif: true } },
        items: {
          orderBy: { id: "asc" },
          select: { quantity: true, price: true, product: { select: { name: true } } },
        },
      },
    });

    if (!pedido?.paidAmount || Number(pedido.paidAmount) <= 0) {
      return null;
    }

    return {
      concept: "venta",
      lineas: conAjuste(
        lineasPedido(
          pedido.items.map((item) => ({
            productName: item.product.name,
            quantity: item.quantity,
            priceCentimos: aCentimos(Number(item.price)),
          })),
        ),
        aCentimos(Number(pedido.paidAmount)),
      ),
      cliente: { ...pedido.user, address: null },
      paymentMethod: pedido.paymentMethod,
    };
  }

  const solicitud = await tx.serviceRequest.findUnique({
    where: { id: entidad.id },
    select: {
      paidAmount: true,
      paymentMethod: true,
      equipmentType: true,
      brand: true,
      model: true,
      address: true,
      client: { select: { id: true, name: true, email: true, nif: true } },
      quote: { select: { status: true, budgetAmount: true, diagnosticFee: true } },
    },
  });

  if (!solicitud?.paidAmount || Number(solicitud.paidAmount) <= 0 || !solicitud.quote) {
    return null;
  }

  const esReparacion = solicitud.quote.status === "aceptado";
  const lineas = esReparacion
    ? lineasReparacion({
        equipo: EQUIPMENT_LABELS[solicitud.equipmentType].toLowerCase(),
        brand: solicitud.brand,
        model: solicitud.model,
        budgetCentimos: aCentimos(Number(solicitud.quote.budgetAmount)),
        diagnosticFeeCentimos: aCentimos(Number(solicitud.quote.diagnosticFee)),
      })
    : lineasDiagnostico(aCentimos(Number(solicitud.quote.diagnosticFee)));

  return {
    concept: esReparacion ? "reparacion" : "diagnostico",
    lineas: conAjuste(lineas, aCentimos(Number(solicitud.paidAmount))),
    cliente: { ...solicitud.client, address: solicitud.address },
    paymentMethod: solicitud.paymentMethod,
  };
}

/**
 * Factura ordinaria emitida al registrar el cobro, en la misma transacción.
 * `issuedAt` es el momento del cobro. El seed histórico emite con ella sus
 * retroactivas (serie `MIG`, con ID fijo).
 */
export async function emitirFacturaDeCobroEnTx(
  tx: Tx,
  entidad: EntidadFacturable,
  ahora: Date,
  opciones: { serie?: "FAC" | "MIG"; id?: string } = {},
): Promise<{ id: string; code: string } | null> {
  const contenido = await contenidoFacturaEnTx(tx, entidad);

  if (!contenido) {
    return null;
  }

  return crearFacturaEnTx(tx, {
    id: opciones.id,
    serie: opciones.serie ?? "FAC",
    kind: "ordinaria",
    concept: contenido.concept,
    issuedAt: ahora,
    entidad,
    cliente: contenido.cliente,
    lineas: contenido.lineas,
    vatRate: await tipoIvaVigente(tx),
    paymentMethod: contenido.paymentMethod,
  });
}

const SELECT_FACTURA_CADENA = {
  id: true,
  code: true,
  series: true,
  kind: true,
  total: true,
  issuedAt: true,
  rectifiesInvoiceId: true,
  replacesInvoiceId: true,
} as const;

export async function facturasDeEntidadEnTx(tx: Tx, entidad: EntidadFacturable) {
  return tx.invoice.findMany({
    where: entidad.tipo === "pedido" ? { orderId: entidad.id } : { requestId: entidad.id },
    orderBy: [{ issuedAt: "asc" }, { createdAt: "asc" }],
    select: SELECT_FACTURA_CADENA,
  });
}

/** ¿Tiene el pedido o la solicitud una factura ordinaria sin rectificar? */
export async function tieneFacturaVigenteEnTx(tx: Tx, entidad: EntidadFacturable): Promise<boolean> {
  return facturaVigente(await facturasDeEntidadEnTx(tx, entidad)) !== null;
}

/** Bloquea la fila del pedido o la solicitud hasta el final de la transacción. */
export async function bloquearEntidadEnTx(
  tx: Tx,
  entidad: EntidadFacturable,
): Promise<boolean> {
  const filas =
    entidad.tipo === "pedido"
      ? await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "orders" WHERE "id" = ${entidad.id} FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "service_requests" WHERE "id" = ${entidad.id} FOR UPDATE`;

  return filas.length > 0;
}

export type ResultadoRectificativa =
  | { ok: true; id: string; code: string }
  | { ok: false; motivo: "no-existe" | "no-vigente" };

/** Motivo por el que una rectificativa o una re-emisión no se hace. */
export class SinCambios extends Error {
  constructor(public readonly motivo: string) {
    super(motivo);
  }
}

type DatosRectificativa = {
  invoiceId: string;
  motivo: string;
  staffId: string;
};

/**
 * Rectificativa dentro de una transacción ya abierta, emitida en `ahora`.
 * Lanza `SinCambios` si la factura no existe o no es la vigente.
 */
export async function emitirRectificativaEnTx(
  tx: Tx,
  datos: DatosRectificativa,
  ahora: Date,
  id?: string,
): Promise<{ id: string; code: string }> {
  const original = await tx.invoice.findUnique({
    where: { id: datos.invoiceId },
    include: { lines: { orderBy: { position: "asc" } } },
  });

  if (!original) {
    throw new SinCambios("no-existe");
  }

  const entidad: EntidadFacturable = original.orderId
    ? { tipo: "pedido", id: original.orderId }
    : { tipo: "solicitud", id: original.requestId as string };

  await bloquearEntidadEnTx(tx, entidad);

  const vigente = facturaVigente(await facturasDeEntidadEnTx(tx, entidad));

  if (vigente?.id !== original.id) {
    throw new SinCambios("no-vigente");
  }

  return crearFacturaEnTx(tx, {
    id,
    serie: "RECT",
    kind: "rectificativa",
    concept: original.concept,
    issuedAt: ahora,
    entidad,
    mode: original.mode,
    cliente: {
      id: original.customerId,
      name: original.customerName,
      email: original.customerEmail,
      nif: original.customerTaxId,
      address: original.customerAddress,
    },
    lineas: lineasRectificativa(
      original.lines.map((linea) => ({
        description: linea.description,
        quantity: linea.quantity,
        unitPriceCentimos: aCentimos(Number(linea.unitPrice)),
      })),
    ),
    vatRate: Number(original.vatRate),
    paymentMethod: original.paymentMethod,
    rectifiesInvoiceId: original.id,
    reason: datos.motivo,
    issuedById: datos.staffId,
  });
}

/**
 * Rectificativa total y manual: copia las líneas en negativo, con el tipo de
 * IVA, el concepto y los datos del cliente de la original. No toca el cobro ni
 * el estado de la entidad.
 */
export async function emitirRectificativa(
  datos: DatosRectificativa,
): Promise<ResultadoRectificativa> {
  try {
    return await prisma.$transaction(async (tx) => {
      const factura = await emitirRectificativaEnTx(tx, datos, new Date());

      return { ok: true as const, ...factura };
    });
  } catch (error) {
    if (error instanceof SinCambios) {
      return { ok: false, motivo: error.motivo as "no-existe" | "no-vigente" };
    }

    throw error;
  }
}

export type ResultadoReemision =
  | { ok: true; id: string; code: string }
  | { ok: false; motivo: "no-existe" | "no-permitida" };

type DatosReemision = {
  entidad: EntidadFacturable;
  motivo: string;
  staffId: string;
};

/**
 * Re-emisión dentro de una transacción ya abierta, emitida en `ahora`. Lanza
 * `SinCambios` si la entidad no existe o no cumple las condiciones.
 */
export async function reemitirFacturaEnTx(
  tx: Tx,
  datos: DatosReemision,
  ahora: Date,
  id?: string,
): Promise<{ id: string; code: string }> {
  if (!(await bloquearEntidadEnTx(tx, datos.entidad))) {
    throw new SinCambios("no-existe");
  }

  const estado =
    datos.entidad.tipo === "pedido"
      ? await tx.order.findUniqueOrThrow({
          where: { id: datos.entidad.id },
          select: { status: true, paidAt: true },
        })
      : await tx.serviceRequest.findUniqueOrThrow({
          where: { id: datos.entidad.id },
          select: { status: true, paidAt: true },
        });
  const facturas = await facturasDeEntidadEnTx(tx, datos.entidad);
  const contenido = await contenidoFacturaEnTx(tx, datos.entidad);
  const sustituida = facturas.filter((factura) => factura.kind === "ordinaria").at(-1);

  if (
    !contenido ||
    !sustituida ||
    !puedeReemitir({ pagada: estado.paidAt !== null, status: estado.status, facturas })
  ) {
    throw new SinCambios("no-permitida");
  }

  const original = await tx.invoice.findUniqueOrThrow({
    where: { id: sustituida.id },
    select: { vatRate: true },
  });

  return crearFacturaEnTx(tx, {
    id,
    serie: "FAC",
    kind: "ordinaria",
    concept: contenido.concept,
    issuedAt: ahora,
    entidad: datos.entidad,
    cliente: contenido.cliente,
    lineas: contenido.lineas,
    vatRate: Number(original.vatRate),
    paymentMethod: contenido.paymentMethod,
    replacesInvoiceId: sustituida.id,
    reissueReason: datos.motivo,
    issuedById: datos.staffId,
  });
}

/**
 * "Emitir factura de nuevo": nueva FAC a partir del cobro registrado, con los
 * datos actuales del cliente (por ejemplo, un NIF corregido) y el tipo de IVA
 * de la factura sustituida.
 */
export async function reemitirFactura(datos: DatosReemision): Promise<ResultadoReemision> {
  try {
    return await prisma.$transaction(async (tx) => {
      const factura = await reemitirFacturaEnTx(tx, datos, new Date());

      return { ok: true as const, ...factura };
    });
  } catch (error) {
    if (error instanceof SinCambios) {
      return { ok: false, motivo: error.motivo as "no-existe" | "no-permitida" };
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export type FacturaCadena = {
  id: string;
  code: string;
  series: InvoiceSeries;
  kind: InvoiceKind;
  total: number;
  issuedAt: Date;
  rectifiesInvoiceId: string | null;
  replacesInvoiceId: string | null;
};

/** Facturas de un pedido o solicitud, en orden de emisión, para los detalles. */
export async function listarFacturasDeEntidad(
  entidad: EntidadFacturable,
): Promise<FacturaCadena[]> {
  const facturas = await facturasDeEntidadEnTx(prisma, entidad);

  return facturas.map((factura) => ({ ...factura, total: Number(factura.total) }));
}

export const TAMANO_PAGINA_FACTURAS = 25;

export type FiltrosFacturas = {
  anio?: number;
  serie?: InvoiceSeries;
  concepto?: InvoiceConcept;
  cliente?: string;
  pagina: number;
};

export type FacturaResumen = {
  id: string;
  code: string;
  series: InvoiceSeries;
  concept: InvoiceConcept;
  issuedAt: Date;
  customerName: string;
  customerEmail: string;
  total: number;
  isBackfill: boolean;
  rectifiesCode: string | null;
  replacesCode: string | null;
};

const SELECT_FACTURA_RESUMEN = {
  id: true,
  code: true,
  series: true,
  concept: true,
  issuedAt: true,
  customerName: true,
  customerEmail: true,
  total: true,
  isBackfill: true,
  rectifies: { select: { code: true } },
  replaces: { select: { code: true } },
} as const satisfies Prisma.InvoiceSelect;

function aResumen({
  rectifies,
  replaces,
  ...fila
}: Prisma.InvoiceGetPayload<{ select: typeof SELECT_FACTURA_RESUMEN }>): FacturaResumen {
  return {
    ...fila,
    total: Number(fila.total),
    rectifiesCode: rectifies?.code ?? null,
    replacesCode: replaces?.code ?? null,
  };
}

export async function listarFacturasAdmin(
  filtros: FiltrosFacturas,
): Promise<{ facturas: FacturaResumen[]; total: number }> {
  const where: Prisma.InvoiceWhereInput = {
    ...(filtros.anio ? { year: filtros.anio } : {}),
    ...(filtros.serie ? { series: filtros.serie } : {}),
    ...(filtros.concepto ? { concept: filtros.concepto } : {}),
    ...(filtros.cliente
      ? {
          OR: [
            { customerName: { contains: filtros.cliente, mode: "insensitive" } },
            { customerEmail: { contains: filtros.cliente, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: [{ issuedAt: "desc" }, { code: "desc" }],
      skip: (filtros.pagina - 1) * TAMANO_PAGINA_FACTURAS,
      take: TAMANO_PAGINA_FACTURAS,
      select: SELECT_FACTURA_RESUMEN,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { total, facturas: filas.map(aResumen) };
}

const SELECT_FACTURA_DETALLE = {
  id: true,
  code: true,
  series: true,
  kind: true,
  concept: true,
  mode: true,
  issuedAt: true,
  isBackfill: true,
  orderId: true,
  requestId: true,
  reason: true,
  reissueReason: true,
  customerId: true,
  customerName: true,
  customerEmail: true,
  customerTaxId: true,
  customerAddress: true,
  issuerName: true,
  issuerTaxId: true,
  issuerAddress: true,
  issuerEmail: true,
  vatRate: true,
  baseTotal: true,
  vatTotal: true,
  total: true,
  paymentMethod: true,
  issuedBy: { select: { name: true } },
  rectifies: { select: { id: true, code: true } },
  rectifications: { select: { id: true, code: true } },
  replaces: { select: { id: true, code: true } },
  replacements: { select: { id: true, code: true } },
  lines: {
    orderBy: { position: "asc" },
    select: {
      position: true,
      description: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      lineBase: true,
      lineVat: true,
    },
  },
} as const satisfies Prisma.InvoiceSelect;

type FilaDetalle = Prisma.InvoiceGetPayload<{ select: typeof SELECT_FACTURA_DETALLE }>;

export type FacturaDetalle = ReturnType<typeof aDetalle>;

function aDetalle(fila: FilaDetalle) {
  return {
    ...fila,
    vatRate: Number(fila.vatRate),
    baseTotal: Number(fila.baseTotal),
    vatTotal: Number(fila.vatTotal),
    total: Number(fila.total),
    issuedByName: fila.issuedBy?.name ?? null,
    rectificadaPor: fila.rectifications[0] ?? null,
    sustituidaPor: fila.replacements[0] ?? null,
    lines: fila.lines.map((linea) => ({
      ...linea,
      unitPrice: Number(linea.unitPrice),
      lineTotal: Number(linea.lineTotal),
      lineBase: Number(linea.lineBase),
      lineVat: Number(linea.lineVat),
    })),
  };
}

export async function obtenerFacturaAdmin(id: string): Promise<FacturaDetalle | null> {
  const fila = await prisma.invoice.findUnique({ where: { id }, select: SELECT_FACTURA_DETALLE });

  return fila ? aDetalle(fila) : null;
}

/** Filtrada por propietario: una factura ajena se trata como inexistente. */
export async function obtenerFacturaCliente(
  id: string,
  clientId: string,
): Promise<FacturaDetalle | null> {
  const fila = await prisma.invoice.findFirst({
    where: { id, customerId: clientId },
    select: SELECT_FACTURA_DETALLE,
  });

  return fila ? aDetalle(fila) : null;
}

export async function listarFacturasCliente(clientId: string): Promise<FacturaResumen[]> {
  const filas = await prisma.invoice.findMany({
    where: { customerId: clientId },
    orderBy: [{ issuedAt: "desc" }, { code: "desc" }],
    select: SELECT_FACTURA_RESUMEN,
  });

  return filas.map(aResumen);
}
