import Link from "next/link";

import { AttentionPanel } from "@/components/admin/attention-panel";
import { ExportCsvForm } from "@/components/admin/export-csv-form";
import { ultimosDias } from "@/lib/exports";
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
  searchParams: Promise<{ estado?: string; repuesto?: string; cobro?: string }>;
}) {
  const { estado, repuesto, cobro } = await searchParams;
  const filtro = SERVICE_STATUSES.find((valor) => valor === estado);
  const soloFaltasRepuesto = repuesto === "1";
  const soloPendientesCobro = cobro === "pendiente";

  // Expiraciones perezosas: así los contadores y el listado cuadran.
  await expirarPresupuestosVencidos();

  const [solicitudes, conteos, faltasPendientes] = await Promise.all([
    listarSolicitudesAdmin(filtro, { soloFaltasRepuesto, soloPendientesCobro }),
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

      <AttentionPanel />

      {faltasPendientes > 0 ? (
        <p
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          {faltasPendientes === 1
            ? "Hay 1 falta de repuesto sin atender."
            : `Hay ${faltasPendientes} faltas de repuesto sin atender.`}{" "}
          {soloFaltasRepuesto ? (
            <Link href="/admin/solicitudes" className="font-medium underline">
              Ver todas las solicitudes
            </Link>
          ) : (
            <Link href="/admin/solicitudes?repuesto=1" className="font-medium underline">
              Ver solo esas solicitudes
            </Link>
          )}
        </p>
      ) : null}

      {soloPendientesCobro ? (
        <p
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          role="status"
        >
          Solo reparaciones listas con importe pendiente de cobro.{" "}
          <Link href="/admin/solicitudes" className="font-medium underline">
            Ver todas las solicitudes
          </Link>
        </p>
      ) : null}

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2 text-sm">
        <FiltroLink
          href="/admin/solicitudes"
          activo={!filtro && !soloFaltasRepuesto && !soloPendientesCobro}
          etiqueta="Todas"
          total={total}
        />
        {SERVICE_STATUSES.map((valor) => (
          <FiltroLink
            key={valor}
            href={`/admin/solicitudes?estado=${valor}`}
            activo={filtro === valor && !soloFaltasRepuesto && !soloPendientesCobro}
            etiqueta={SERVICE_STATUS_META[valor].label}
            total={conteos[valor]}
          />
        ))}
      </nav>

      <ExportCsvForm
        accion="/admin/exportar/reparaciones.csv"
        {...ultimosDias(new Date(), 30)}
        filtros={{ estado: filtro }}
        descripcion={`Una fila por solicitud con entrada en el rango${filtro ? `, solo «${SERVICE_STATUS_META[filtro].label}»` : ""}.`}
      />

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
