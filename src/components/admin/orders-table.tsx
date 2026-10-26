import Link from "next/link";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatearFechaCorta, formatEuros } from "@/lib/format";
import type { PedidoAdminResumen } from "@/lib/orders";

export function OrdersTable({ pedidos }: { pedidos: PedidoAdminResumen[] }) {
  if (pedidos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
        No hay pedidos con este filtro.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">
                Cliente
              </th>
              <th scope="col" className="px-4 py-3">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3">
                Total
              </th>
              <th scope="col" className="px-4 py-3">
                Estado
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Detalle</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pedidos.map((pedido) => (
              <tr key={pedido.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">
                    {pedido.client.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {pedido.client.email}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatearFechaCorta(pedido.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                  {formatEuros(pedido.total)}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={pedido.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/pedidos/${pedido.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {pedidos.map((pedido) => (
          <li key={pedido.id}>
            <Link
              href={`/admin/pedidos/${pedido.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {pedido.client.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {pedido.client.email}
                  </p>
                </div>
                <OrderStatusBadge status={pedido.status} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <p className="text-xs text-slate-500">
                  {formatearFechaCorta(pedido.createdAt)}
                </p>
                <p className="font-semibold text-slate-950">
                  {formatEuros(pedido.total)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
