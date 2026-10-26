import type { ReactNode } from "react";

import { formatearFechaHora } from "@/lib/format";
import {
  NOTE_TYPE_LABELS,
  esFaltaPendiente,
  ordenarNotas,
  type NotaReparacion,
} from "@/lib/request-notes";

/**
 * Notas internas de una reparación. Las faltas de repuesto pendientes van
 * arriba y destacadas; `acciones` permite al panel añadir "Marcar atendida".
 */
export function NoteList({
  notas,
  acciones,
}: {
  notas: NotaReparacion[];
  acciones?: (nota: NotaReparacion) => ReactNode;
}) {
  if (notas.length === 0) {
    return <p className="text-sm text-slate-600">Todavía no hay notas.</p>;
  }

  return (
    <ul className="space-y-2">
      {ordenarNotas(notas).map((nota) => {
        const pendiente = esFaltaPendiente(nota);
        const accion = acciones?.(nota);

        return (
          <li
            key={nota.id}
            className={`rounded-lg border px-4 py-3 text-sm ${
              pendiente ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-slate-50"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  nota.type === "falta_repuesto"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {NOTE_TYPE_LABELS[nota.type]}
                {pendiente ? " · pendiente" : ""}
              </span>
              <span className="text-xs text-slate-500">
                {nota.author?.name ?? "Usuario eliminado"} · {formatearFechaHora(nota.createdAt)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-slate-800">{nota.body}</p>
            {nota.resolvedAt ? (
              <p className="mt-2 text-xs text-emerald-700">
                Atendida{nota.resolvedBy ? ` por ${nota.resolvedBy.name}` : ""} el{" "}
                {formatearFechaHora(nota.resolvedAt)}
              </p>
            ) : null}
            {accion ? <div className="mt-3">{accion}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
