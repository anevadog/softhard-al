import Link from "next/link";

import { formatearFechaCorta, formatEuros } from "@/lib/format";
import { INVOICE_SERIES_LABELS } from "@/lib/invoices";
import type { FacturaCadena } from "@/server/data/invoices";

/** Facturas de un pedido o solicitud en orden: original, rectificativa, re-emisión… */
export function InvoiceChain({
  facturas,
  rutaFacturas,
}: {
  facturas: readonly FacturaCadena[];
  rutaFacturas: "/admin/facturas" | "/app/facturas";
}) {
  if (facturas.length === 0) {
    return <p className="text-sm text-slate-600">Sin facturas.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {facturas.map((factura) => (
        <li key={factura.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div>
            <Link
              href={`${rutaFacturas}/${factura.id}`}
              className="font-medium text-slate-900 underline underline-offset-2"
            >
              {factura.code}
            </Link>
            <span className="ml-2 text-xs text-slate-500">
              {INVOICE_SERIES_LABELS[factura.series]} · {formatearFechaCorta(factura.issuedAt)}
            </span>
          </div>
          <span className={factura.total < 0 ? "text-rose-700" : "text-slate-900"}>
            {formatEuros(factura.total)}
          </span>
        </li>
      ))}
    </ul>
  );
}
