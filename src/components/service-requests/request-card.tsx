import type { ComponentType } from "react";

import type { EquipmentType } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/service-requests/status-badge";
import {
  BoxIcon,
  LaptopIcon,
  MonitorIcon,
  PrinterIcon,
  type IconProps,
} from "@/components/site/icons";
import {
  EQUIPMENT_LABELS,
  MODALITY_LABELS,
  TIME_SLOT_LABELS,
  type SolicitudResumen,
} from "@/lib/service-requests";

const ICONS: Record<EquipmentType, ComponentType<IconProps>> = {
  ordenador: MonitorIcon,
  portatil: LaptopIcon,
  impresora: PrinterIcon,
  otro: BoxIcon,
};

const formateadorFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function RequestCard({ solicitud }: { solicitud: SolicitudResumen }) {
  const Icon = ICONS[solicitud.equipmentType];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">
              {EQUIPMENT_LABELS[solicitud.equipmentType]} · {solicitud.brand} {solicitud.model}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {MODALITY_LABELS[solicitud.modality]} · {TIME_SLOT_LABELS[solicitud.timeSlot]}
            </p>
          </div>
        </div>

        <StatusBadge status={solicitud.status} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{solicitud.issue}</p>

      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Creada el {formateadorFecha.format(solicitud.createdAt)}
      </p>
    </article>
  );
}
