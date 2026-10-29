import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { InvoiceChain } from "@/components/invoices/invoice-chain";
import { OnlinePaymentButton, OnlinePaymentNotice } from "@/components/payments/online-payment";
import { auth } from "@/lib/auth";
import {
  formatearFechaCorta,
  formatearFechaHora,
  formatEuros,
} from "@/lib/format";
import {
  liberarPedidosCaducadosSinFallar,
  obtenerPedidoCliente,
} from "@/server/data/orders";
import { iniciarPagoPedidoAction } from "@/server/actions/online-payments";
import { listarFacturasDeEntidad } from "@/server/data/invoices";
import { puedePagarOnline } from "@/server/data/online-payments";

export const metadata = {
  title: "Detalle del pedido",
};

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string | string[]; pago?: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/app/pedidos/${id}`)}`);
  }

  const { creado, pago } = await searchParams;
  await liberarPedidosCaducadosSinFallar();
  const pedido = await obtenerPedidoCliente(id, session.user.id);

  if (!pedido) {
    notFound();
  }

  const [facturas, pagable] = await Promise.all([
    listarFacturasDeEntidad({ tipo: "pedido", id: pedido.id }),
    puedePagarOnline({ tipo: "pedido", id: pedido.id }, session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/pedidos"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver a mis pedidos
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Pedido {pedido.id.slice(0, 8).toUpperCase()}
          </h1>
          <OrderStatusBadge status={pedido.status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Creado el {formatearFechaCorta(pedido.createdAt)}
          {pedido.paidAt ? ` · Pagado el ${formatearFechaCorta(pedido.paidAt)}` : null}
        </p>
      </div>

      {creado === "1" ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Pedido creado correctamente. Hemos reservado el stock y te hemos enviado
          la confirmación; ya puedes pagarlo.
        </p>
      ) : null}

      <OnlinePaymentNotice pago={pago} />

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Productos del pedido
        </h2>

        <ul className="mt-4 divide-y divide-slate-100">
          {pedido.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div>
                <p className="font-medium text-slate-900">{item.productName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.quantity} × {formatEuros(item.price)}
                </p>
              </div>
              <p className="font-semibold text-slate-950">
                {formatEuros(item.subtotal)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
          <span className="text-base font-semibold text-slate-950">Total</span>
          <span className="text-lg font-semibold text-slate-950">
            {formatEuros(pedido.total)}
          </span>
        </div>
      </section>

      {pedido.status === "pendiente" ? (
        <div className="space-y-3 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <p>
            Hemos registrado tu pedido. Nos pondremos en contacto para coordinar la
            entrega.
            {pedido.expiresAt ? (
              <>
                {" "}
                Si no se paga antes del{" "}
                <strong>{formatearFechaHora(pedido.expiresAt)}</strong>, caducará y
                los productos volverán a estar disponibles.
              </>
            ) : null}
          </p>
          {pagable ? (
            <OnlinePaymentButton accion={iniciarPagoPedidoAction} id={pedido.id} importe={pedido.total} />
          ) : null}
        </div>
      ) : null}

      {pedido.status === "caducado" ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          Este pedido caducó porque no se pagó a tiempo. Hemos liberado el stock
          de sus productos; si todavía los quieres, haz un pedido nuevo.
        </p>
      ) : null}

      {facturas.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Facturas</h2>
          <div className="mt-3">
            <InvoiceChain facturas={facturas} rutaFacturas="/app/facturas" />
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/app/pedidos"
          className="font-medium text-slate-900 underline underline-offset-2"
        >
          Mis pedidos
        </Link>
        <Link
          href="/productos"
          className="font-medium text-slate-700 underline underline-offset-2"
        >
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
