import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { RectifyInvoiceForm } from "@/components/invoices/invoice-forms";
import { PrintButton } from "@/components/invoices/print-button";
import { obtenerFacturaAdmin } from "@/server/data/invoices";

export const metadata = {
  title: "Factura",
};

export default async function AdminFacturaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emitida?: string }>;
}) {
  const { id } = await params;
  const { emitida } = await searchParams;
  const factura = await obtenerFacturaAdmin(id);

  if (!factura) {
    notFound();
  }

  const vigente = factura.kind === "ordinaria" && !factura.rectificadaPor;
  const origen = factura.orderId
    ? { href: `/admin/pedidos/${factura.orderId}`, etiqueta: "Ver pedido" }
    : { href: `/admin/solicitudes/${factura.requestId}`, etiqueta: "Ver solicitud" };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/facturas" className="text-sm text-slate-500 hover:text-slate-900">
          ← Volver a facturas
        </Link>
        <div className="flex items-center gap-3">
          <Link href={origen.href} className="text-sm text-slate-700 underline underline-offset-2">
            {origen.etiqueta}
          </Link>
          <PrintButton />
        </div>
      </div>

      {emitida === "1" ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden" role="status">
          Factura emitida.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <InvoiceDocument factura={factura} rutaFacturas="/admin/facturas" />

        <aside className="space-y-4 print:hidden">
          {factura.issuedByName ? (
            <p className="text-sm text-slate-600">Emitida por {factura.issuedByName}.</p>
          ) : null}
          {vigente ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">Rectificar</h2>
              <div className="mt-3">
                <RectifyInvoiceForm invoiceId={factura.id} />
              </div>
            </section>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {factura.kind === "rectificativa"
                ? "Las rectificativas no se rectifican."
                : "Esta factura ya está rectificada."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
