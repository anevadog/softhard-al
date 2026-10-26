import Link from "next/link";

import { WeekNav } from "@/components/admin/week-nav";
import { StaffWorkLogActions } from "@/components/admin/work-log-staff-actions";
import { WorkLogList, etiquetaReparacionFichaje } from "@/components/taller/work-log-list";
import { formatearFechaHora } from "@/lib/format";
import { minutosPorTrabajador } from "@/lib/reports";
import {
  excedeHorasAbierto,
  formatearDuracion,
  minutosFichaje,
  semanaDesdeClave,
  totalMinutos,
} from "@/lib/work-logs";
import { requerirStaff } from "@/server/authorization";
import { listarTrabajadoresAsignables } from "@/server/data/assignments";
import { listarFichajesSemana } from "@/server/data/reports";
import {
  listarFichajesAbiertos,
  obtenerHorasFichajeAbierto,
} from "@/server/data/work-logs";

export const metadata = {
  title: "Fichajes",
};

const AVISOS = {
  cerrado: "Fichaje cerrado.",
  corregido: "Fichaje corregido.",
} as const;

export default async function FichajesAbiertosPage({
  searchParams,
}: {
  searchParams: Promise<{
    cerrado?: string;
    corregido?: string;
    semana?: string;
    trabajador?: string;
  }>;
}) {
  const { cerrado, corregido, semana: claveSemana, trabajador } = await searchParams;
  await requerirStaff();

  const ahora = new Date();
  const semana = semanaDesdeClave(claveSemana, ahora);
  const trabajadores = await listarTrabajadoresAsignables();
  // Un id desconocido o ajeno en la URL equivale a "Todos".
  const filtro = trabajadores.find((item) => item.id === trabajador) ?? null;

  const [abiertos, horasAviso, fichajesSemana] = await Promise.all([
    listarFichajesAbiertos(),
    obtenerHorasFichajeAbierto(),
    listarFichajesSemana(semana, filtro?.id ?? null),
  ]);
  const porTrabajador = minutosPorTrabajador(
    fichajesSemana,
    filtro ? [filtro] : trabajadores,
    ahora,
  );
  const aviso = cerrado === "1" ? AVISOS.cerrado : corregido === "1" ? AVISOS.corregido : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Fichajes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Las horas se muestran en hora de Madrid.
        </p>
      </div>

      {aviso ? (
        <p
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {aviso}
        </p>
      ) : null}

      <h2 className="text-lg font-semibold text-slate-900">Abiertos ahora</h2>
      <p className="-mt-4 text-sm text-slate-600">
        Se destacan los que llevan más de {horasAviso} horas abiertos.
      </p>

      {abiertos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No hay fichajes abiertos.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {abiertos.map((fichaje) => {
            const excede = excedeHorasAbierto(fichaje, horasAviso, ahora);

            return (
              <li
                key={fichaje.id}
                className={`rounded-xl border bg-white p-4 text-sm ${
                  excede ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-slate-900">{fichaje.user.name}</p>
                  <p className="text-slate-700">
                    {formatearDuracion(minutosFichaje(fichaje, ahora))}
                  </p>
                </div>
                <p className="mt-1 text-slate-600">
                  Desde {formatearFechaHora(fichaje.startedAt)} ·{" "}
                  {fichaje.request ? (
                    <Link
                      href={`/admin/solicitudes/${fichaje.request.id}`}
                      className="text-slate-900 underline-offset-2 hover:underline"
                    >
                      {etiquetaReparacionFichaje(fichaje.request)}
                    </Link>
                  ) : (
                    "Horas generales"
                  )}
                </p>
                {fichaje.note ? (
                  <p className="mt-1 text-xs text-slate-600">Nota: {fichaje.note}</p>
                ) : null}
                {excede ? (
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    Lleva abierto más de {horasAviso} horas.
                  </p>
                ) : null}
                <div className="mt-3">
                  <StaffWorkLogActions fichaje={fichaje} origen="abiertos" />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="fichajes-semana" className="space-y-4">
        <h2 id="fichajes-semana" className="text-lg font-semibold text-slate-900">
          Fichajes de la semana
        </h2>

        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="semana" value={semana.clave} />
          <div>
            <label htmlFor="trabajador" className="block font-medium text-slate-700">
              Trabajador
            </label>
            <select
              id="trabajador"
              name="trabajador"
              defaultValue={filtro?.id ?? ""}
              className="mt-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Todos</option>
              {trabajadores.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-800"
          >
            Filtrar
          </button>
        </form>

        <WeekNav
          ruta="/admin/fichajes"
          semana={semana}
          ahora={ahora}
          parametros={{ trabajador: filtro?.id }}
        />

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="text-slate-600">
            Total {filtro ? `de ${filtro.name}` : "del taller"}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatearDuracion(totalMinutos(fichajesSemana, ahora))}
          </p>
          <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
            {porTrabajador.map((fila) => (
              <li key={fila.id} className="flex justify-between gap-3">
                <span className="text-slate-700">{fila.name}</span>
                <span className="font-medium text-slate-900">
                  {formatearDuracion(fila.minutos)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <WorkLogList
            fichajes={fichajesSemana}
            ahora={ahora}
            mostrarTrabajador
            mostrarReparacion
            vacio="No hay fichajes en esta semana."
            acciones={(fichaje) => <StaffWorkLogActions fichaje={fichaje} origen="abiertos" />}
          />
        </div>
      </section>
    </div>
  );
}
