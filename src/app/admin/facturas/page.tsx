import Link from "next/link";

import type { InvoiceConcept, InvoiceSeries } from "@/generated/prisma/enums";
import { formatearFechaCorta, formatEuros } from "@/lib/format";
import { INVOICE_CONCEPT_LABELS, INVOICE_SERIES_LABELS } from "@/lib/invoices";
import {
  TAMANO_PAGINA_FACTURAS,
  listarFacturasAdmin,
} from "@/server/data/invoices";

export const metadata = {
  title: "Facturas",
};

const SERIES = Object.keys(INVOICE_SERIES_LABELS) as InvoiceSeries[];
const CONCEPTOS = Object.keys(INVOICE_CONCEPT_LABELS) as InvoiceConcept[];

const campoClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

type Params = {
  anio?: string;
  serie?: string;
  concepto?: string;
  cliente?: string;
  pagina?: string;
};

export default async function AdminFacturasPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const anio = /^\d{4}$/.test(params.anio ?? "") ? Number(params.anio) : undefined;
  const serie = SERIES.find((valor) => valor === params.serie);
  const concepto = CONCEPTOS.find((valor) => valor === params.concepto);
  const cliente = params.cliente?.trim().slice(0, 100) || undefined;
  const pagina = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);

  const { facturas, total } = await listarFacturasAdmin({ anio, serie, concepto, cliente, pagina });
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_FACTURAS));

  function enlacePagina(destino: number): string {
    const query = new URLSearchParams();
    if (anio) query.set("anio", String(anio));
    if (serie) query.set("serie", serie);
    if (concepto) query.set("concepto", concepto);
    if (cliente) query.set("cliente", cliente);
    query.set("pagina", String(destino));

    return `/admin/facturas?${query.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Facturas</h1>
        <p className="mt-1 text-sm text-slate-600">
          {total} {total === 1 ? "factura" : "facturas"}. Simuladas, sin validez fiscal; las
          rectificativas restan.
        </p>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5" method="get">
        <label className="text-sm text-slate-700">
          Año
          <input name="anio" inputMode="numeric" defaultValue={anio ?? ""} placeholder="2026" className={campoClass} />
        </label>
        <label className="text-sm text-slate-700">
          Serie
          <select name="serie" defaultValue={serie ?? ""} className={campoClass}>
            <option value="">Todas</option>
            {SERIES.map((valor) => (
              <option key={valor} value={valor}>
                {valor} · {INVOICE_SERIES_LABELS[valor]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Concepto
          <select name="concepto" defaultValue={concepto ?? ""} className={campoClass}>
            <option value="">Todos</option>
            {CONCEPTOS.map((valor) => (
              <option key={valor} value={valor}>
                {INVOICE_CONCEPT_LABELS[valor]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Cliente
          <input name="cliente" defaultValue={cliente ?? ""} placeholder="Nombre o email" className={campoClass} />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filtrar
          </button>
          <Link href="/admin/facturas" className="text-sm text-slate-600 underline underline-offset-2">
            Limpiar
          </Link>
        </div>
      </form>

      {facturas.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No hay facturas con estos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Factura</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facturas.map((factura) => (
                <tr key={factura.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/facturas/${factura.id}`}
                      className="font-medium text-slate-900 underline underline-offset-2"
                    >
                      {factura.code}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {factura.isBackfill ? "Retroactiva" : INVOICE_SERIES_LABELS[factura.series]}
                      {factura.rectifiesCode ? ` · rectifica ${factura.rectifiesCode}` : ""}
                      {factura.replacesCode ? ` · sustituye a ${factura.replacesCode}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatearFechaCorta(factura.issuedAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{INVOICE_CONCEPT_LABELS[factura.concept]}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{factura.customerName}</p>
                    <p className="text-xs text-slate-500">{factura.customerEmail}</p>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${factura.total < 0 ? "text-rose-700" : "text-slate-900"}`}
                  >
                    {formatEuros(factura.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
          {pagina > 1 ? (
            <Link href={enlacePagina(pagina - 1)} className="underline underline-offset-2">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-600">
            Página {Math.min(pagina, paginas)} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={enlacePagina(pagina + 1)} className="underline underline-offset-2">
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
