import Link from "next/link";

import { EntradaGeneralForm, SalidaForm } from "@/components/taller/work-log-forms";
import { etiquetaReparacionFichaje } from "@/components/taller/work-log-list";
import { formatearHora } from "@/lib/format";
import { excedeHorasAbierto, formatearDuracion, minutosFichaje } from "@/lib/work-logs";
import type { Fichaje } from "@/server/data/work-logs";

/** Fichaje actual del trabajador en el inicio de /trabajador. */
export function WorkLogCard({
  abierto,
  horasAviso,
  ahora,
}: {
  abierto: Fichaje | null;
  horasAviso: number;
  ahora: Date;
}) {
  return (
    <section
      aria-labelledby="fichaje-actual"
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="fichaje-actual" className="text-base font-semibold text-slate-900">
          Fichaje
        </h2>
        <Link
          href="/trabajador/fichajes"
          className="text-sm text-slate-600 transition-colors hover:text-slate-900"
        >
          Mis fichajes →
        </Link>
      </div>

      {abierto ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-700">
            Fichado desde las{" "}
            <span className="font-medium text-slate-900">
              {formatearHora(abierto.startedAt)}
            </span>{" "}
            ({formatearDuracion(minutosFichaje(abierto, ahora))}) en{" "}
            {abierto.request ? (
              <Link
                href={`/trabajador/reparaciones/${abierto.request.id}`}
                className="font-medium text-slate-900 underline-offset-2 hover:underline"
              >
                {etiquetaReparacionFichaje(abierto.request)}
              </Link>
            ) : (
              <span className="font-medium text-slate-900">horas generales</span>
            )}
            .
          </p>
          {abierto.note ? (
            <p className="text-xs text-slate-600">Nota: {abierto.note}</p>
          ) : null}
          {excedeHorasAbierto(abierto, horasAviso, ahora) ? (
            <p
              className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
              role="alert"
            >
              Este fichaje lleva abierto más de {horasAviso} horas. Si olvidaste
              fichar la salida, ciérralo y avisa al encargado para que corrija la hora.
            </p>
          ) : null}
          <SalidaForm workLogId={abierto.id} origen="inicio" />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600">
            No tienes ningún fichaje abierto. Para fichar en una reparación, entra en su
            detalle; debe estar en reparación.
          </p>
          <EntradaGeneralForm />
        </div>
      )}
    </section>
  );
}
