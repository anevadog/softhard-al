import Link from "next/link";
import type { ReactNode } from "react";

import { formatearFechaHora } from "@/lib/format";
import { describirInactividad, limiteInactividad } from "@/lib/inactivity";
import { EQUIPMENT_LABELS, etiquetaEstado } from "@/lib/service-requests";
import {
  listarDevueltasSinResponsable,
  listarReparacionesSinActividad,
  obtenerHorasInactividad,
  type ReparacionAviso,
} from "@/server/data/inactivity";

/**
 * "Requieren atención": reparaciones del taller sin actividad y devueltas sin
 * responsable. Se evalúa al cargar el listado; sin cron.
 */
export async function AttentionPanel() {
  const horas = await obtenerHorasInactividad();
  const ahora = new Date();
  const [sinActividad, devueltas] = await Promise.all([
    listarReparacionesSinActividad(limiteInactividad(ahora, horas)),
    listarDevueltasSinResponsable(),
  ]);

  if (sinActividad.total === 0 && devueltas.total === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="requieren-atencion"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="requieren-atencion" className="text-base font-semibold text-amber-950">
          Requieren atención
        </h2>
        <Link
          href="/admin/reportes#sin-actividad"
          className="text-sm font-medium text-amber-900 underline"
        >
          Ver todas en reportes
        </Link>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Bloque
          titulo={`Sin actividad desde hace más de ${horas} h`}
          total={sinActividad.total}
          mostrados={sinActividad.elementos.length}
          vacio="Ninguna reparación supera el plazo."
        >
          {sinActividad.elementos.map((reparacion) => (
            <Fila key={reparacion.id} reparacion={reparacion}>
              {reparacion.assignee?.name ?? "Sin responsable"} ·{" "}
              {describirInactividad(reparacion.lastActivityAt, ahora)}
            </Fila>
          ))}
        </Bloque>
        <Bloque
          titulo="Devueltas sin responsable"
          total={devueltas.total}
          mostrados={devueltas.elementos.length}
          vacio="No hay reparaciones devueltas pendientes de reasignar."
        >
          {devueltas.elementos.map((reparacion) => (
            <Fila key={reparacion.id} reparacion={reparacion}>
              {reparacion.devolucion
                ? `Devuelta por ${reparacion.devolucion.fromAssignee?.name ?? "usuario eliminado"} el ${formatearFechaHora(reparacion.devolucion.createdAt)}`
                : "Devuelta"}
              {reparacion.devolucion?.reason ? ` · ${reparacion.devolucion.reason}` : ""}
            </Fila>
          ))}
        </Bloque>
      </div>
    </section>
  );
}

function Bloque({
  titulo,
  total,
  mostrados,
  vacio,
  children,
}: {
  titulo: string;
  total: number;
  mostrados: number;
  vacio: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-medium text-amber-950">
        {titulo}
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">
          {total}
        </span>
      </h3>
      {total === 0 ? (
        <p className="mt-2 text-amber-800">{vacio}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">{children}</ul>
      )}
      {total > mostrados ? (
        <p className="mt-2 text-xs text-amber-800">y {total - mostrados} más.</p>
      ) : null}
    </div>
  );
}

function Fila({
  reparacion,
  children,
}: {
  reparacion: ReparacionAviso;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={`/admin/solicitudes/${reparacion.id}`}
        className="block rounded-lg bg-white/70 px-3 py-2 transition-colors hover:bg-white"
      >
        <span className="font-medium text-slate-900">
          {EQUIPMENT_LABELS[reparacion.equipmentType]} · {reparacion.brand} {reparacion.model}
        </span>{" "}
        <span className="text-xs text-slate-500">({etiquetaEstado(reparacion.status)})</span>
        <span className="mt-0.5 block text-xs text-amber-800">{children}</span>
      </Link>
    </li>
  );
}
