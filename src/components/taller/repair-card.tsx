import Link from "next/link";

import { StatusBadge } from "@/components/service-requests/status-badge";
import { formatearFechaHora } from "@/lib/format";
import { EQUIPMENT_LABELS, MODALITY_LABELS } from "@/lib/service-requests";
import type { ReparacionTallerResumen } from "@/lib/worker-requests";

export function RepairCard({ reparacion }: { reparacion: ReparacionTallerResumen }) {
  return (
    <Link
      href={`/trabajador/reparaciones/${reparacion.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-900">
          {EQUIPMENT_LABELS[reparacion.equipmentType]} · {reparacion.brand}{" "}
          {reparacion.model}
        </p>
        <StatusBadge status={reparacion.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{reparacion.issue}</p>
      <p className="mt-2 text-xs text-slate-500">
        {MODALITY_LABELS[reparacion.modality]} · Última actividad:{" "}
        {formatearFechaHora(reparacion.lastActivityAt)}
      </p>
    </Link>
  );
}
