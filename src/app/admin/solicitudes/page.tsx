import Link from "next/link";

import { RequestsTable } from "@/components/admin/requests-table";
import {
  SERVICE_STATUSES,
  SERVICE_STATUS_META,
} from "@/lib/service-requests";
import {
  contarPorEstado,
  listarSolicitudesAdmin,
} from "@/server/data/admin-requests";
import { contarFaltasRepuestoPendientes } from "@/server/data/request-notes";
import { expirarPresupuestosVencidos } from "@/server/data/service-requests";

export const metadata = {
  title: "Solicitudes",
};

export default async function AdminSolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const filtro = SERVICE_STATUSES.find((valor) => valor === estado);

  // Expiraciones perezosas: así los contadores y el listado cuadran.
  await expirarPresupuestosVencidos();

  const [solicitudes, conteos, faltasPendientes] = await Promise.all([
    listarSolicitudesAdmin(filtro),
    contarPorEstado(),
    contarFaltasRepuestoPendientes(),
  ]);

  const total = Object.values(conteos).reduce((suma, valor) => suma + valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Solicitudes
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {total === 0
            ? "Todavía no hay solicitudes registradas."
            : `${total} ${total === 1 ? "solicitud registrada" : "solicitudes registradas"}.`}
        </p>
      </div>

      {faltasPendientes > 0 ? (
        <p
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          {faltasPendientes === 1
            ? "Hay 1 falta de repuesto sin atender."
            : `Hay ${faltasPendientes} faltas de repuesto sin atender.`}{" "}
          Están marcadas en el listado; atiéndelas desde el detalle de cada solicitud.
        </p>
      ) : null}

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2 text-sm">
        <FiltroLink
          href="/admin/solicitudes"
          activo={!filtro}
          etiqueta="Todas"
          total={total}
        />
        {SERVICE_STATUSES.map((valor) => (
          <FiltroLink
            key={valor}
            href={`/admin/solicitudes?estado=${valor}`}
            activo={filtro === valor}
            etiqueta={SERVICE_STATUS_META[valor].label}
            total={conteos[valor]}
          />
        ))}
      </nav>

      <RequestsTable solicitudes={solicitudes} />
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
