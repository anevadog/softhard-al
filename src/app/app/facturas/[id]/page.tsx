import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { PrintButton } from "@/components/invoices/print-button";
import { auth } from "@/lib/auth";
import { obtenerFacturaCliente } from "@/server/data/invoices";

export const metadata = {
  title: "Factura",
};

export default async function FacturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/app/facturas/${id}`)}`);
  }

  // Ajena o inexistente: mismo 404, sin revelar si existe.
  const factura = await obtenerFacturaCliente(id, session.user.id);

  if (!factura) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/app/facturas" className="text-sm text-slate-500 hover:text-slate-900">
          ← Volver a mis facturas
        </Link>
        <PrintButton />
      </div>
      <InvoiceDocument factura={factura} rutaFacturas="/app/facturas" />
    </div>
  );
}
