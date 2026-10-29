import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusForm } from "@/components/admin/order-status-form";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { InvoiceChain } from "@/components/invoices/invoice-chain";
import { ReissueInvoiceForm } from "@/components/invoices/invoice-forms";
import { PaymentSummary } from "@/components/payments/payment-summary";
import { RegisterPaymentForm } from "@/components/payments/register-payment-form";
import {
  formatearFechaCorta,
  formatearFechaHora,
  formatEuros,
} from "@/lib/format";
import { facturaVigente, puedeReemitir } from "@/lib/invoices";
import { cobroEsperadoPedido } from "@/lib/payments";
import { requerirStaff } from "@/server/authorization";
import { obtenerPedidoAdmin } from "@/server/data/admin-orders";
import { listarFacturasDeEntidad } from "@/server/data/invoices";
import { liberarPedidosCaducadosSinFallar } from "@/server/data/orders";

export const metadata = {
  title: "Detalle del pedido",
};

export default async function AdminPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string; cobro?: string }>;
}) {
  const staff = await requerirStaff();
  const { id } = await params;
  const { estado, cobro } = await searchParams;
  await liberarPedidosCaducadosSinFallar();
  const pedido = await obtenerPedidoAdmin(id);

  if (!pedido) {
    notFound();
  }

  const facturas = await listarFacturasDeEntidad({ tipo: "pedido", id: pedido.id });
  const hayFacturaVigente = facturaVigente(facturas) !== null;
  const reemitible = puedeReemitir({
    pagada: pedido.cobro !== null,
    status: pedido.status,
    facturas,
  });

  const importeEsperado = pedido.cobro
    ? null
    : cobroEsperadoPedido(
        { status: pedido.status, total: pedido.total, expiresAt: pedido.expiresAt, paidAt: null },
        new Date(),
      );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/pedidos"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver a pedidos
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Pedido {pedido.id.slice(0, 8).toUpperCase()}
          </h1>
          <OrderStatusBadge status={pedido.status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Creado el {formatearFechaCorta(pedido.createdAt)}
          {pedido.status === "pendiente" && pedido.expiresAt
            ? ` · Caduca el ${formatearFechaHora(pedido.expiresAt)}`
            : null}
        </p>
      </div>

      {pedido.status === "caducado" ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Caducado por impago: el sistema lo marcó al vencer y repuso el stock de
          sus productos.
        </p>
      ) : null}

      {cobro === "1" ? (
        <p
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          Cobro registrado. El pedido ha pasado a pagado.
        </p>
      ) : null}

      {estado === "1" ? (
        <p
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          Estado del pedido actualizado.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Cliente</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Nombre</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {pedido.client.name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="mt-0.5 text-slate-900">{pedido.client.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Teléfono</dt>
                <dd className="mt-0.5 text-slate-900">
                  {pedido.client.phone ?? "No indicado"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Líneas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Los precios están congelados en el momento de la compra.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-4">
                      Producto
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Precio
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Cantidad
                    </th>
                    <th scope="col" className="py-2 pl-4 text-right">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pedido.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 text-slate-900">
                        {item.productName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                        {formatEuros(item.price)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                        {item.quantity}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-4 text-right font-medium text-slate-900">
                        {formatEuros(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th
                      scope="row"
                      colSpan={3}
                      className="pt-4 text-right text-sm font-medium text-slate-600"
                    >
                      Total del pedido
                    </th>
                    <td className="pt-4 pl-4 text-right text-base font-semibold text-slate-950">
                      {formatEuros(pedido.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          {pedido.cobro || importeEsperado !== null ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">Cobro</h2>
              <div className="mt-4">
                {pedido.cobro ? (
                  <PaymentSummary cobro={pedido.cobro} />
                ) : importeEsperado !== null ? (
                  <RegisterPaymentForm
                    entidad="pedido"
                    id={pedido.id}
                    importeEsperado={importeEsperado}
                    puedeEditarImporte={staff.role === "admin"}
                  />
                ) : null}

          {facturas.length > 0 || reemitible ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">Facturas</h2>
              <div className="mt-3">
                <InvoiceChain facturas={facturas} rutaFacturas="/admin/facturas" />
                {reemitible ? (
                  <div className="mt-4">
                    <ReissueInvoiceForm entidad="pedido" id={pedido.id} />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Cambiar estado
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Un pendiente pasa a pagado al registrar su cobro, o se cancela.
              Pagado → entregado o cancelado. Un pendiente sin pagar caduca solo
              al vencer.
            </p>
            <div className="mt-4">
              <OrderStatusForm
                orderId={pedido.id}
                status={pedido.status}
                facturaVigente={hayFacturaVigente}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
