import Link from "next/link";

import { OrdersTable } from "@/components/admin/orders-table";
import { ORDER_STATUSES, ORDER_STATUS_META } from "@/lib/orders";
import {
  contarPedidosPorEstado,
  listarPedidosAdmin,
} from "@/server/data/admin-orders";
import { liberarPedidosCaducadosSinFallar } from "@/server/data/orders";

export const metadata = {
  title: "Pedidos",
};

export default async function AdminPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const filtro = ORDER_STATUSES.find((valor) => valor === estado);

  await liberarPedidosCaducadosSinFallar();
  const [pedidos, conteos] = await Promise.all([
    listarPedidosAdmin(filtro),
    contarPedidosPorEstado(),
  ]);

  const total = Object.values(conteos).reduce((suma, valor) => suma + valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Pedidos
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {total === 0
            ? "Todavía no hay pedidos registrados."
            : `${total} ${total === 1 ? "pedido registrado" : "pedidos registrados"}.`}
        </p>
      </div>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2 text-sm">
        <FiltroLink
          href="/admin/pedidos"
          activo={!filtro}
          etiqueta="Todas"
          total={total}
        />
        {ORDER_STATUSES.map((valor) => (
          <FiltroLink
            key={valor}
            href={`/admin/pedidos?estado=${valor}`}
            activo={filtro === valor}
            etiqueta={ORDER_STATUS_META[valor].label}
            total={conteos[valor]}
          />
        ))}
      </nav>

      <OrdersTable pedidos={pedidos} />
    </div>
  );
}

function FiltroLink({
  href,
  activo,
  etiqueta,
  total,
}: {
  href: string;
  activo: boolean;
  etiqueta: string;
  total: number;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 transition-colors ${
        activo
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {etiqueta}
      <span className={activo ? "text-slate-300" : "text-slate-400"}>{total}</span>
    </Link>
  );
}
