import Link from "next/link";

import { StaffWorkLogActions } from "@/components/admin/work-log-staff-actions";
import { etiquetaReparacionFichaje } from "@/components/taller/work-log-list";
import { formatearFechaHora } from "@/lib/format";
import { excedeHorasAbierto, formatearDuracion, minutosFichaje } from "@/lib/work-logs";
import { requerirStaff } from "@/server/authorization";
import {
  listarFichajesAbiertos,
  obtenerHorasFichajeAbierto,
} from "@/server/data/work-logs";

export const metadata = {
  title: "Fichajes abiertos",
};

const AVISOS = {
  cerrado: "Fichaje cerrado.",
  corregido: "Fichaje corregido.",
} as const;

export default async function FichajesAbiertosPage({
  searchParams,
}: {
  searchParams: Promise<{ cerrado?: string; corregido?: string }>;
}) {
  const { cerrado, corregido } = await searchParams;
  await requerirStaff();

  const [abiertos, horasAviso] = await Promise.all([
    listarFichajesAbiertos(),
    obtenerHorasFichajeAbierto(),
  ]);
  const ahora = new Date();
  const aviso = cerrado === "1" ? AVISOS.cerrado : corregido === "1" ? AVISOS.corregido : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Fichajes abiertos
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Trabajadores que están fichados ahora. Se destacan los que llevan más de{" "}
          {horasAviso} horas abiertos. Las horas se muestran en hora de Madrid.
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
    </div>
  );
}
