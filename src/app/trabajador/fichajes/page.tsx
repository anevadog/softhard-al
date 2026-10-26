import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkLogList, etiquetaReparacionFichaje } from "@/components/taller/work-log-list";
import { formatearFechaCorta } from "@/lib/format";
import {
  desplazarSemana,
  formatearDuracion,
  minutosPorClave,
  semanaDe,
  semanaDesdeClave,
  totalMinutos,
} from "@/lib/work-logs";
import { requerirPersonalTaller } from "@/server/authorization";
import { listarMisFichajesSemana } from "@/server/data/work-logs";

export const metadata = {
  title: "Mis fichajes",
};

export default async function MisFichajesPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana: claveSemana } = await searchParams;
  const usuario = await requerirPersonalTaller();

  // Solo fichan los trabajadores; el staff consulta los fichajes en el panel.
  if (usuario.role !== "trabajador") {
    redirect("/admin/fichajes");
  }

  const ahora = new Date();
  const semana = semanaDesdeClave(claveSemana, ahora);
  const actual = semanaDe(ahora);
  const anterior = desplazarSemana(semana, -1);
  const siguiente = desplazarSemana(semana, 1);
  const esActual = semana.clave === actual.clave;
  const fichajes = await listarMisFichajesSemana(usuario.id, semana);
  const total = totalMinutos(fichajes, ahora);
  // Se agrupa por id para no mezclar dos reparaciones con la misma marca y modelo.
  const porReparacion = minutosPorClave(fichajes, (fichaje) => fichaje.request?.id ?? null, ahora);
  const etiquetas = new Map(
    fichajes.map((fichaje) => [
      fichaje.request?.id ?? null,
      etiquetaReparacionFichaje(fichaje.request),
    ]),
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/trabajador"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver al taller
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          Mis fichajes
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Semana del {formatearFechaCorta(semana.inicio)} al{" "}
          {formatearFechaCorta(new Date(semana.fin.getTime() - 1))} (hora de Madrid).
        </p>
      </div>

      <nav aria-label="Semanas" className="flex items-center justify-between gap-3 text-sm">
        <Link
          href={`/trabajador/fichajes?semana=${anterior.clave}`}
          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-100"
        >
          ← Anterior
        </Link>
        {esActual ? null : (
          <Link
            href="/trabajador/fichajes"
            className="text-slate-600 transition-colors hover:text-slate-900"
          >
            Esta semana
          </Link>
        )}
        {esActual ? (
          <span className="rounded-lg border border-slate-200 px-3 py-2 text-slate-400">
            Siguiente →
          </span>
        ) : (
          <Link
            href={`/trabajador/fichajes?semana=${siguiente.clave}`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-100"
          >
            Siguiente →
          </Link>
        )}
      </nav>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Total de la semana</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{formatearDuracion(total)}</p>
        {porReparacion.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
            {porReparacion.map((grupo) => (
              <li key={grupo.clave ?? "general"} className="flex justify-between gap-3">
                <span className="text-slate-700">{etiquetas.get(grupo.clave)}</span>
                <span className="font-medium text-slate-900">
                  {formatearDuracion(grupo.minutos)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Fichajes</h2>
        <div className="mt-4">
          <WorkLogList
            fichajes={fichajes}
            ahora={ahora}
            mostrarReparacion
            vacio="No hay fichajes esta semana."
          />
        </div>
      </section>
    </div>
  );
}
