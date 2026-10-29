import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { formatearFechaCorta, formatEuros } from "@/lib/format";
import { INVOICE_CONCEPT_LABELS } from "@/lib/invoices";
import { listarFacturasCliente } from "@/server/data/invoices";

export const metadata = {
  title: "Mis facturas",
};

export default async function FacturasPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/app/facturas");
  }

  const facturas = await listarFacturasCliente(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mis facturas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Facturas de tus compras y reparaciones. Puedes imprimirlas o guardarlas en PDF.
        </p>
      </div>

      {facturas.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Todavía no tienes facturas. Se emiten al registrarse el pago.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {facturas.map((factura) => (
            <li key={factura.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <Link
                  href={`/app/facturas/${factura.id}`}
                  className="font-medium text-slate-900 underline underline-offset-2"
                >
                  {factura.code}
                </Link>
                <p className="text-xs text-slate-500">
                  {formatearFechaCorta(factura.issuedAt)} · {INVOICE_CONCEPT_LABELS[factura.concept]}
                  {factura.rectifiesCode ? ` · rectifica ${factura.rectifiesCode}` : ""}
                </p>
              </div>
              <span className={factura.total < 0 ? "text-rose-700" : "font-semibold text-slate-950"}>
                {formatEuros(factura.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
