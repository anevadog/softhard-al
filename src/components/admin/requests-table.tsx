import Link from "next/link";

import { StatusBadge } from "@/components/service-requests/status-badge";
import { formatearFechaCorta } from "@/lib/format";
import {
  EQUIPMENT_LABELS,
  type SolicitudAdminResumen,
} from "@/lib/service-requests";

export function RequestsTable({
  solicitudes,
}: {
  solicitudes: SolicitudAdminResumen[];
}) {
  if (solicitudes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
        No hay solicitudes con este filtro.
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
                Equipo
              </th>
              <th scope="col" className="px-4 py-3">
                Entrada
              </th>
              <th scope="col" className="px-4 py-3">
                Estado
              </th>
              <th scope="col" className="px-4 py-3">
                Presupuesto
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Detalle</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {solicitudes.map((solicitud) => (
              <tr key={solicitud.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{solicitud.client.name}</p>
                  <p className="text-xs text-slate-500">{solicitud.client.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {EQUIPMENT_LABELS[solicitud.equipmentType]} · {solicitud.brand}{" "}
                  {solicitud.model}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatearFechaCorta(solicitud.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={solicitud.status} />
                    <FaltasRepuesto total={solicitud.faltasRepuestoPendientes} />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {solicitud.quote ? "Creado" : "Sin crear"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/solicitudes/${solicitud.id}`}
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
        {solicitudes.map((solicitud) => (
          <li key={solicitud.id}>
            <Link
              href={`/admin/solicitudes/${solicitud.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {EQUIPMENT_LABELS[solicitud.equipmentType]} · {solicitud.brand}{" "}
                    {solicitud.model}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {solicitud.client.name} · {solicitud.client.email}
                  </p>
                </div>
                <StatusBadge status={solicitud.status} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatearFechaCorta(solicitud.createdAt)} ·{" "}
                {solicitud.quote ? "Con presupuesto" : "Sin presupuesto"}
              </p>
              {solicitud.faltasRepuestoPendientes > 0 ? (
                <div className="mt-2">
                  <FaltasRepuesto total={solicitud.faltasRepuestoPendientes} />
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function FaltasRepuesto({ total }: { total: number }) {
  if (total === 0) {
    return null;
  }

  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-300">
      {total === 1 ? "Falta repuesto" : `${total} faltas de repuesto`}
    </span>
  );
}
