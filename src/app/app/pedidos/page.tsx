import Link from "next/link";
import { redirect } from "next/navigation";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { auth } from "@/lib/auth";
import { formatearFechaCorta, formatEuros } from "@/lib/format";
import {
  liberarPedidosCaducadosSinFallar,
  listarPedidosCliente,
} from "@/server/data/orders";

export const metadata = {
  title: "Mis pedidos",
};

export default async function PedidosPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/app/pedidos");
  }

  await liberarPedidosCaducadosSinFallar();
  const pedidos = await listarPedidosCliente(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Mis pedidos
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Consulta tus compras y el estado de cada pedido.
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="font-medium text-slate-900">Todavía no tienes pedidos.</p>
          <p className="mt-2 text-sm text-slate-600">
            Cuando finalices una compra aparecerá aquí.
          </p>
          <Link
            href="/productos"
            className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Ver productos
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {pedidos.map((pedido) => (
            <li key={pedido.id}>
              <Link
                href={`/app/pedidos/${pedido.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Pedido {pedido.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatearFechaCorta(pedido.createdAt)}
                    </p>
                  </div>
                  <OrderStatusBadge status={pedido.status} />
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-600">
                    {pedido.unidades}{" "}
                    {pedido.unidades === 1 ? "unidad" : "unidades"} ·{" "}
                    {pedido.lineas}{" "}
                    {pedido.lineas === 1 ? "producto" : "productos"}
                  </p>
                  <p className="text-base font-semibold text-slate-950">
                    {formatEuros(pedido.total)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
