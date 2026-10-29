import Link from "next/link";

import { formatearFechaHora, formatEuros } from "@/lib/format";
import {
  INVOICE_CONCEPT_LABELS,
  INVOICE_MODE_LABELS,
  INVOICE_SERIES_LABELS,
  LEYENDA_FACTURA,
} from "@/lib/invoices";
import { etiquetaMetodoPago } from "@/lib/payments";
import type { FacturaDetalle } from "@/server/data/invoices";

function porcentaje(tipo: number): string {
  return `${tipo.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
}

/**
 * Documento de la factura, pensado también para imprimir (el "PDF" se obtiene
 * con la impresión del navegador). `rutaFacturas` decide a dónde enlazan la
 * original, la rectificativa y la sustituta: panel o área de cliente.
 */
export function InvoiceDocument({
  factura,
  rutaFacturas,
}: {
  factura: FacturaDetalle;
  rutaFacturas: "/admin/facturas" | "/app/facturas";
}) {
  const relacionadas = [
    factura.rectifies && { etiqueta: "Rectifica a", ...factura.rectifies },
    factura.rectificadaPor && { etiqueta: "Rectificada por", ...factura.rectificadaPor },
    factura.replaces && { etiqueta: "Sustituye a", ...factura.replaces },
    factura.sustituidaPor && { etiqueta: "Sustituida por", ...factura.sustituidaPor },
  ].filter((item): item is { etiqueta: string; id: string; code: string } => Boolean(item));

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800 print:border print:border-amber-300">
        {LEYENDA_FACTURA}
      </p>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Factura {INVOICE_SERIES_LABELS[factura.series].toLowerCase()} ·{" "}
            {INVOICE_MODE_LABELS[factura.mode].toLowerCase()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {factura.code}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Emitida el {formatearFechaHora(factura.issuedAt)} ·{" "}
            {INVOICE_CONCEPT_LABELS[factura.concept]}
          </p>
        </div>
        <div className="text-right text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{factura.issuerName}</p>
          <p>NIF {factura.issuerTaxId}</p>
          <p>{factura.issuerAddress}</p>
          <p>{factura.issuerEmail}</p>
        </div>
      </header>

      <section className="mt-6 rounded-lg bg-slate-50 p-4 text-sm print:bg-transparent print:p-0">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</h2>
        <p className="mt-1 font-medium text-slate-900">{factura.customerName}</p>
        {factura.customerTaxId ? <p className="text-slate-700">NIF {factura.customerTaxId}</p> : null}
        {factura.customerAddress ? <p className="text-slate-700">{factura.customerAddress}</p> : null}
        <p className="text-slate-700">{factura.customerEmail}</p>
      </section>

      {factura.reason || factura.reissueReason ? (
        <p className="mt-4 text-sm text-slate-700">
          <span className="font-medium">
            {factura.reason ? "Motivo de la rectificación: " : "Motivo de la re-emisión: "}
          </span>
          {factura.reason ?? factura.reissueReason}
        </p>
      ) : null}

      {relacionadas.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm print:hidden">
          {relacionadas.map((item) => (
            <li key={item.etiqueta}>
              {item.etiqueta}{" "}
              <Link
                href={`${rutaFacturas}/${item.id}`}
                className="font-medium text-slate-900 underline underline-offset-2"
              >
                {item.code}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">Concepto</th>
              <th className="py-2 pr-3 text-right font-medium">Cant.</th>
              <th className="py-2 pr-3 text-right font-medium">PVP unit.</th>
              <th className="py-2 pr-3 text-right font-medium">Base</th>
              <th className="py-2 pr-3 text-right font-medium">IVA</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {factura.lines.map((linea) => (
              <tr key={linea.position}>
                <td className="py-2 pr-3 text-slate-900">{linea.description}</td>
                <td className="py-2 pr-3 text-right text-slate-700">{linea.quantity}</td>
                <td className="py-2 pr-3 text-right text-slate-700">{formatEuros(linea.unitPrice)}</td>
                <td className="py-2 pr-3 text-right text-slate-700">{formatEuros(linea.lineBase)}</td>
                <td className="py-2 pr-3 text-right text-slate-700">{formatEuros(linea.lineVat)}</td>
                <td className="py-2 text-right font-medium text-slate-900">{formatEuros(linea.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Base imponible</dt>
          <dd className="text-slate-900">{formatEuros(factura.baseTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">IVA ({porcentaje(factura.vatRate)})</dt>
          <dd className="text-slate-900">{formatEuros(factura.vatTotal)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
          <dt className="text-slate-950">Total</dt>
          <dd className="text-slate-950">{formatEuros(factura.total)}</dd>
        </div>
        <div className="flex justify-between pt-1 text-xs text-slate-500">
          <dt>Forma de pago</dt>
          <dd>{etiquetaMetodoPago(factura.paymentMethod)}</dd>
        </div>
      </dl>
    </article>
  );
}
