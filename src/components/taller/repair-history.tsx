import { formatearFechaHora } from "@/lib/format";
import { etiquetaEstado } from "@/lib/service-requests";
import type {
  AsignacionHistorialTaller,
  EstadoHistorialTaller,
} from "@/lib/worker-requests";

export function StatusHistory({ entradas }: { entradas: EstadoHistorialTaller[] }) {
  if (entradas.length === 0) {
    return (
      <p className="text-sm text-slate-600">Todavía no hay cambios de estado.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {entradas.map((entrada) => (
        <li
          key={entrada.id}
          className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
        >
          <p className="font-medium text-slate-900">
            {etiquetaEstado(entrada.fromStatus)} → {etiquetaEstado(entrada.toStatus)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {entrada.changedBy ? `Por ${entrada.changedBy.name}` : "Automático"} ·{" "}
            {formatearFechaHora(entrada.createdAt)}
          </p>
          {entrada.reason ? (
            <p className="mt-1 text-xs text-slate-600">Motivo: {entrada.reason}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function AssignmentHistory({
  entradas,
}: {
  entradas: AsignacionHistorialTaller[];
}) {
  if (entradas.length === 0) {
    return (
      <p className="text-sm text-slate-600">Todavía no hay cambios de responsable.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {entradas.map((entrada) => (
        <li
          key={entrada.id}
          className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
        >
          <p className="font-medium text-slate-900">
            {entrada.fromAssignee?.name ?? "Sin responsable"} →{" "}
            {entrada.toAssignee?.name ?? "Sin responsable"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {entrada.changedBy ? `Por ${entrada.changedBy.name}` : "Automático"} ·{" "}
            {formatearFechaHora(entrada.createdAt)}
          </p>
          {entrada.reason ? (
            <p className="mt-1 text-xs text-slate-600">Motivo: {entrada.reason}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
