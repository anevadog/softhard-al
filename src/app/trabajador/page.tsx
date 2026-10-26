import Link from "next/link";

import { RepairCard } from "@/components/taller/repair-card";
import { WorkLogCard } from "@/components/taller/work-log-card";
import { etiquetaEstado } from "@/lib/service-requests";
import { agruparPorEstado } from "@/lib/worker-requests";
import { requerirPersonalTaller } from "@/server/authorization";
import {
  obtenerFichajeAbierto,
  obtenerHorasFichajeAbierto,
} from "@/server/data/work-logs";
import {
  listarMisReparaciones,
  listarReparacionesParaTomar,
} from "@/server/data/worker-requests";

const AVISOS_FICHAJE = {
  entrada: "Entrada fichada.",
  salida: "Salida fichada.",
} as const;

export const metadata = {
  title: "Taller",
};

export default async function TallerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ devuelta?: string; fichaje?: string }>;
}) {
  const { devuelta, fichaje } = await searchParams;
  const usuario = await requerirPersonalTaller();
  const esTrabajador = usuario.role === "trabajador";

  const [mias, paraTomar, abierto, horasAviso] = await Promise.all([
    listarMisReparaciones(usuario.id),
    esTrabajador ? listarReparacionesParaTomar() : Promise.resolve([]),
    esTrabajador ? obtenerFichajeAbierto(usuario.id) : Promise.resolve(null),
    obtenerHorasFichajeAbierto(),
  ]);
  const grupos = agruparPorEstado(mias);
  const ahora = new Date();
  const avisoFichaje =
    fichaje === "entrada" || fichaje === "salida" ? AVISOS_FICHAJE[fichaje] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Hola, {usuario.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tus reparaciones abiertas, primero las que necesitan que hagas algo.
        </p>
      </div>

      {devuelta === "1" ? (
        <p
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Reparación devuelta al encargado.
        </p>
      ) : null}

      {avisoFichaje ? (
        <p
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {avisoFichaje}
        </p>
      ) : null}

      {esTrabajador ? (
        <WorkLogCard abierto={abierto} horasAviso={horasAviso} ahora={ahora} />
      ) : null}

      {!esTrabajador ? (
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p>
            Como {usuario.role} gestionas el taller desde el panel: allí asignas,
            reasignas y corriges estados.
          </p>
          <Link
            href="/admin/solicitudes"
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-sky-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800"
          >
            Ir al panel de solicitudes
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="mis-reparaciones" className="space-y-4">
        <h2 id="mis-reparaciones" className="text-lg font-semibold text-slate-900">
          Mis reparaciones
        </h2>

        {grupos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            No tienes reparaciones abiertas.
          </p>
        ) : (
          grupos.map((grupo) => (
            <div key={grupo.estado} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {etiquetaEstado(grupo.estado)}
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                  {grupo.reparaciones.length}
                </span>
                {grupo.requiereAccion ? (
                  <span className="text-xs font-normal text-amber-700">
                    Requiere acción
                  </span>
                ) : null}
              </h3>
              <ul className="space-y-2">
                {grupo.reparaciones.map((reparacion) => (
                  <li key={reparacion.id}>
                    <RepairCard reparacion={reparacion} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {esTrabajador ? (
        <section aria-labelledby="para-tomar" className="space-y-3">
          <div>
            <h2 id="para-tomar" className="text-lg font-semibold text-slate-900">
              Para tomar
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Reparaciones aceptadas que aún no tienen responsable.
            </p>
          </div>

          {paraTomar.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
              No hay reparaciones pendientes de tomar.
            </p>
          ) : (
            <ul className="space-y-2">
              {paraTomar.map((reparacion) => (
                <li key={reparacion.id}>
                  <RepairCard reparacion={reparacion} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
