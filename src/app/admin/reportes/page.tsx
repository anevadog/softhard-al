import Link from "next/link";
import type { ReactNode } from "react";

import { WeekNav } from "@/components/admin/week-nav";
import { etiquetaReparacionFichaje } from "@/components/taller/work-log-list";
import { formatearFechaHora } from "@/lib/format";
import { describirInactividad, limiteInactividad } from "@/lib/inactivity";
import { minutosPorReparacion, minutosPorTrabajador } from "@/lib/reports";
import {
  EQUIPMENT_LABELS,
  SERVICE_STATUSES,
  SERVICE_STATUS_META,
  etiquetaEstado,
} from "@/lib/service-requests";
import { formatearDuracion, semanaDesdeClave, totalMinutos } from "@/lib/work-logs";
import { requerirStaff } from "@/server/authorization";
import { contarPorEstado } from "@/server/data/admin-requests";
import { listarTrabajadoresAsignables } from "@/server/data/assignments";
import {
  listarDevueltasSinResponsable,
  listarReparacionesSinActividad,
  obtenerHorasInactividad,
} from "@/server/data/inactivity";
import { listarFichajesDeReparaciones, listarFichajesSemana } from "@/server/data/reports";

export const metadata = {
  title: "Reportes",
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana: claveSemana } = await searchParams;
  await requerirStaff();

  const ahora = new Date();
  const semana = semanaDesdeClave(claveSemana, ahora);
  const horasInactividad = await obtenerHorasInactividad();

  const [trabajadores, fichajesSemana, conteos, sinActividad, devueltas] = await Promise.all([
    listarTrabajadoresAsignables(),
    listarFichajesSemana(semana),
    contarPorEstado(),
    listarReparacionesSinActividad(limiteInactividad(ahora, horasInactividad), null),
    listarDevueltasSinResponsable(null),
  ]);

  const idsReparaciones = [
    ...new Set(fichajesSemana.flatMap((fichaje) => (fichaje.request ? [fichaje.request.id] : []))),
  ];
  const historicos = await listarFichajesDeReparaciones(idsReparaciones);
  const porTrabajador = minutosPorTrabajador(fichajesSemana, trabajadores, ahora);
  const porReparacion = minutosPorReparacion(fichajesSemana, historicos, ahora);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reportes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Las horas cuentan en la semana en la que empieza cada fichaje; los abiertos,
          hasta ahora.
        </p>
      </div>

      <WeekNav ruta="/admin/reportes" semana={semana} ahora={ahora} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion id="horas-trabajador" titulo="Horas por trabajador">
          <Tabla
            cabeceras={["Trabajador", "Fichajes", "Horas"]}
            vacio="No hay trabajadores."
            filas={porTrabajador.map((fila) => [
              fila.name,
              String(fila.fichajes),
              formatearDuracion(fila.minutos),
            ])}
            pie={["Total", String(fichajesSemana.length), formatearDuracion(totalMinutos(fichajesSemana, ahora))]}
          />
        </Seccion>

        <Seccion id="horas-reparacion" titulo="Horas por reparación">
          <Tabla
            cabeceras={["Reparación", "Semana", "Acumulado"]}
            vacio="No hay fichajes esta semana."
            filas={porReparacion.map((fila) => [
              fila.request ? (
                <Link
                  key={fila.request.id}
                  href={`/admin/solicitudes/${fila.request.id}`}
                  className="text-slate-900 underline-offset-2 hover:underline"
                >
                  {etiquetaReparacionFichaje(fila.request)}
                </Link>
              ) : (
                "Horas generales"
              ),
              formatearDuracion(fila.minutosSemana),
              fila.minutosAcumulados === null ? "—" : formatearDuracion(fila.minutosAcumulados),
            ])}
          />
        </Seccion>
      </div>

      <Seccion id="por-estado" titulo="Reparaciones por estado (ahora)">
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {SERVICE_STATUSES.map((estado) => (
            <li key={estado}>
              <Link
                href={`/admin/solicitudes?estado=${estado}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50"
              >
                <span className="text-slate-700">{SERVICE_STATUS_META[estado].label}</span>
                <span className="font-semibold text-slate-900">{conteos[estado]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion
          id="sin-actividad"
          titulo={`Sin actividad desde hace más de ${horasInactividad} h (${sinActividad.total})`}
        >
          {sinActividad.total === 0 ? (
            <p className="text-sm text-slate-600">Ninguna reparación supera el plazo.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {sinActividad.elementos.map((reparacion) => (
                <li key={reparacion.id}>
                  <Link
                    href={`/admin/solicitudes/${reparacion.id}`}
                    className="block rounded-lg border border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      {EQUIPMENT_LABELS[reparacion.equipmentType]} · {reparacion.brand}{" "}
                      {reparacion.model}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      {etiquetaEstado(reparacion.status)} ·{" "}
                      {reparacion.assignee?.name ?? "Sin responsable"} ·{" "}
                      {describirInactividad(reparacion.lastActivityAt, ahora)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        <Seccion id="devueltas" titulo={`Devueltas sin responsable (${devueltas.total})`}>
          {devueltas.total === 0 ? (
            <p className="text-sm text-slate-600">
              No hay reparaciones devueltas pendientes de reasignar.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {devueltas.elementos.map((reparacion) => (
                <li key={reparacion.id}>
                  <Link
                    href={`/admin/solicitudes/${reparacion.id}`}
                    className="block rounded-lg border border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      {EQUIPMENT_LABELS[reparacion.equipmentType]} · {reparacion.brand}{" "}
                      {reparacion.model}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      {etiquetaEstado(reparacion.status)}
                      {reparacion.devolucion
                        ? ` · devuelta por ${reparacion.devolucion.fromAssignee?.name ?? "usuario eliminado"} el ${formatearFechaHora(reparacion.devolucion.createdAt)}`
                        : ""}
                      {reparacion.devolucion?.reason ? ` · ${reparacion.devolucion.reason}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </div>
    </div>
  );
}

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
    >
      <h2 id={`${id}-titulo`} className="text-base font-semibold text-slate-900">
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tabla({
  cabeceras,
  filas,
  pie,
  vacio,
}: {
  cabeceras: [string, string, string];
  filas: ReactNode[][];
  pie?: [string, string, string];
  vacio: string;
}) {
  if (filas.length === 0) {
    return <p className="text-sm text-slate-600">{vacio}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            {cabeceras.map((cabecera, indice) => (
              <th key={cabecera} scope="col" className={`py-2 ${indice > 0 ? "text-right" : ""}`}>
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((fila, indiceFila) => (
            <tr key={indiceFila}>
              {fila.map((celda, indice) => (
                <td
                  key={indice}
                  className={`py-2 ${indice > 0 ? "text-right text-slate-700" : "text-slate-900"}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {pie ? (
          <tfoot className="border-t border-slate-200 font-semibold text-slate-900">
            <tr>
              {pie.map((celda, indice) => (
                <td key={indice} className={`py-2 ${indice > 0 ? "text-right" : ""}`}>
                  {celda}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
