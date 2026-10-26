import Link from "next/link";

import { formatearFechaCorta } from "@/lib/format";
import { abreviarPedido, etiquetaMotivoStock } from "@/lib/stock";
import type { MovimientoStockAdmin } from "@/server/data/stock";

function Variacion({ value }: { value: number }) {
  return (
    <span
      className={
        value > 0
          ? "font-medium text-emerald-700"
          : "font-medium text-rose-700"
      }
    >
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

export function StockHistory({
  movimientos,
}: {
  movimientos: MovimientoStockAdmin[];
}) {
  if (movimientos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        Todavía no hay movimientos de stock.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2.5">
                Fecha
              </th>
              <th scope="col" className="px-3 py-2.5">
                Motivo
              </th>
              <th scope="col" className="px-3 py-2.5">
                Variación
              </th>
              <th scope="col" className="px-3 py-2.5">
                Usuario
              </th>
              <th scope="col" className="px-3 py-2.5">
                Pedido
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movimientos.map((movimiento) => (
              <tr key={movimiento.id}>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                  {formatearFechaCorta(movimiento.createdAt)}
                </td>
                <td className="px-3 py-3 text-slate-900">
                  <p>{etiquetaMotivoStock(movimiento.reason)}</p>
                  {movimiento.note ? (
                    <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                      {movimiento.note}
                    </p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <Variacion value={movimiento.variation} />
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {movimiento.user?.name ?? "Sistema"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                  {movimiento.orderId ? (
                    <Link
                      href={`/admin/pedidos/${movimiento.orderId}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {abreviarPedido(movimiento.orderId)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {movimientos.map((movimiento) => (
          <li
            key={movimiento.id}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">
                  {etiquetaMotivoStock(movimiento.reason)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatearFechaCorta(movimiento.createdAt)} ·{" "}
                  {movimiento.user?.name ?? "Sistema"}
                </p>
              </div>
              <Variacion value={movimiento.variation} />
            </div>
            {movimiento.note ? (
              <p className="mt-2 text-xs text-slate-600">{movimiento.note}</p>
            ) : null}
            {movimiento.orderId ? (
              <p className="mt-1 text-xs">
                <Link
                  href={`/admin/pedidos/${movimiento.orderId}`}
                  className="font-medium text-slate-700 underline-offset-2 hover:underline"
                >
                  {abreviarPedido(movimiento.orderId)}
                </Link>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
