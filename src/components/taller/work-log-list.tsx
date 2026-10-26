import type { ReactNode } from "react";

import { formatearDiaSemana, formatearFechaHora, formatearHora } from "@/lib/format";
import { EQUIPMENT_LABELS } from "@/lib/service-requests";
import { formatearDuracion, minutosFichaje } from "@/lib/work-logs";
import type { Fichaje, ReparacionFichaje } from "@/server/data/work-logs";

export function etiquetaReparacionFichaje(request: ReparacionFichaje | null): string {
  return request
    ? `${EQUIPMENT_LABELS[request.equipmentType]} · ${request.brand} ${request.model}`
    : "Horas generales";
}

/**
 * Lista de fichajes. `mostrarTrabajador` y `mostrarReparacion` ajustan las
 * columnas según la vista; `acciones` permite al panel añadir cerrar/corregir.
 */
export function WorkLogList({
  fichajes,
  ahora,
  mostrarTrabajador = false,
  mostrarReparacion = false,
  vacio,
  acciones,
}: {
  fichajes: Fichaje[];
  ahora: Date;
  mostrarTrabajador?: boolean;
  mostrarReparacion?: boolean;
  vacio: string;
  acciones?: (fichaje: Fichaje) => ReactNode;
}) {
  if (fichajes.length === 0) {
    return <p className="text-sm text-slate-600">{vacio}</p>;
  }

  return (
    <ul className="space-y-2">
      {fichajes.map((fichaje) => (
        <li
          key={fichaje.id}
          className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-medium text-slate-900">
              {formatearDiaSemana(fichaje.startedAt)} · {formatearHora(fichaje.startedAt)} –{" "}
              {fichaje.endedAt ? formatearHora(fichaje.endedAt) : "en curso"}
            </p>
            <p className="text-slate-700">
              {formatearDuracion(minutosFichaje(fichaje, ahora))}
            </p>
          </div>
          {mostrarTrabajador ? (
            <p className="mt-1 text-xs text-slate-600">{fichaje.user.name}</p>
          ) : null}
          {mostrarReparacion ? (
            <p className="mt-1 text-xs text-slate-600">
              {etiquetaReparacionFichaje(fichaje.request)}
            </p>
          ) : null}
          {fichaje.note ? (
            <p className="mt-1 text-xs text-slate-600">Nota: {fichaje.note}</p>
          ) : null}
          {fichaje.editedAt ? (
            <p className="mt-1 text-xs text-amber-700">
              Corregido{fichaje.editedBy ? ` por ${fichaje.editedBy.name}` : ""} el{" "}
              {formatearFechaHora(fichaje.editedAt)}
            </p>
          ) : null}
          {acciones ? <div className="mt-3">{acciones(fichaje)}</div> : null}
        </li>
      ))}
    </ul>
  );
}
