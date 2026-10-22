import type {
  EquipmentType,
  Modality,
  ServiceStatus,
  TimeSlot,
} from "@/generated/prisma/enums";

/** Clases Tailwind completas: deben ser literales para que el escáner las detecte. */
export const SERVICE_STATUS_META: Record<
  ServiceStatus,
  { label: string; badgeClass: string }
> = {
  pendiente: {
    label: "Pendiente",
    badgeClass: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  diagnosticada: {
    label: "Diagnosticada",
    badgeClass: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  aceptada: {
    label: "Aceptada",
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  rechazada: {
    label: "Rechazada",
    badgeClass: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  expirada: {
    label: "Expirada",
    badgeClass: "bg-slate-50 text-slate-500 ring-slate-200",
  },
  en_reparacion: {
    label: "En reparación",
    badgeClass: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  },
  lista: {
    label: "Lista para entregar",
    badgeClass: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  },
  entregada: {
    label: "Entregada",
    badgeClass: "bg-slate-100 text-slate-700 ring-slate-300",
  },
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  ordenador: "Ordenador",
  portatil: "Portátil",
  impresora: "Impresora",
  otro: "Otro",
};

export const MODALITY_LABELS: Record<Modality, string> = {
  domicilio: "Recogida a domicilio",
  taller: "Entrega en taller",
};

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  indiferente: "Indiferente",
};

export function etiquetaEstado(status: ServiceStatus): string {
  return SERVICE_STATUS_META[status].label;
}

/** Datos mínimos que necesita el listado del cliente. */
export type SolicitudResumen = {
  id: string;
  equipmentType: EquipmentType;
  brand: string;
  model: string;
  issue: string;
  modality: Modality;
  timeSlot: TimeSlot;
  status: ServiceStatus;
  createdAt: Date;
};
