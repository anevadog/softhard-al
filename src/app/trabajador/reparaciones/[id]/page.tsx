import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/service-requests/status-badge";
import { AssignmentHistory, StatusHistory } from "@/components/taller/repair-history";
import { ReturnForm } from "@/components/taller/return-form";
import { TakeForm } from "@/components/taller/take-form";
import { WorkerStatusForm } from "@/components/taller/worker-status-form";
import { formatearFechaCorta, formatearFechaHora } from "@/lib/format";
import {
  EQUIPMENT_LABELS,
  MODALITY_LABELS,
  TIME_SLOT_LABELS,
} from "@/lib/service-requests";
import { esEstadoFinal } from "@/lib/service-status";
import { requerirPersonalTaller } from "@/server/authorization";
import { obtenerReparacionTrabajador } from "@/server/data/worker-requests";

export const metadata = {
  title: "Reparación",
};

export default async function ReparacionTallerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tomada?: string; estado?: string }>;
}) {
  const { id } = await params;
  const { tomada, estado } = await searchParams;
  const usuario = await requerirPersonalTaller();

  // Encargado y admin gestionan la reparación desde el panel.
  if (usuario.role !== "trabajador") {
    redirect(`/admin/solicitudes/${encodeURIComponent(id)}`);
  }

  const reparacion = await obtenerReparacionTrabajador(id, usuario.id);

  if (!reparacion) {
    notFound();
  }

  const finalizada = esEstadoFinal(reparacion.status);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/trabajador"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver al taller
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {EQUIPMENT_LABELS[reparacion.equipmentType]} · {reparacion.brand}{" "}
            {reparacion.model}
          </h1>
          <StatusBadge status={reparacion.status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Última actividad: {formatearFechaHora(reparacion.lastActivityAt)}
        </p>
      </div>

      {tomada === "1" ? (
        <Aviso>Reparación tomada. Ahora eres su responsable.</Aviso>
      ) : null}

      {estado === "1" ? <Aviso>Estado actualizado.</Aviso> : null}

      <Seccion titulo="Equipo y avería">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Dato etiqueta="Tipo">{EQUIPMENT_LABELS[reparacion.equipmentType]}</Dato>
          <Dato etiqueta="Marca y modelo">
            {reparacion.brand} {reparacion.model}
          </Dato>
        </dl>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Problema descrito
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {reparacion.issue}
          </p>
        </div>
      </Seccion>

      <Seccion titulo="Visita">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Dato etiqueta="Modalidad">{MODALITY_LABELS[reparacion.modality]}</Dato>
          <Dato etiqueta="Franja horaria">{TIME_SLOT_LABELS[reparacion.timeSlot]}</Dato>
          <Dato etiqueta="Fecha preferida">
            {reparacion.preferredDate
              ? formatearFechaCorta(reparacion.preferredDate)
              : "Sin preferencia"}
          </Dato>
          {reparacion.esMia ? (
            <Dato etiqueta="Cliente">{reparacion.clientName}</Dato>
          ) : null}
        </dl>
      </Seccion>

      <Seccion titulo={reparacion.esMia ? "Acciones" : "Tomar reparación"}>
        {!reparacion.esMia ? (
          <TakeForm requestId={reparacion.id} />
        ) : finalizada ? (
          <p className="text-sm text-slate-600">
            Reparación finalizada. No admite más cambios.
          </p>
        ) : (
          <div className="space-y-4">
            <WorkerStatusForm requestId={reparacion.id} status={reparacion.status} />
            <ReturnForm requestId={reparacion.id} />
          </div>
        )}
      </Seccion>

      {reparacion.esMia ? (
        <>
          <Seccion titulo="Historial de estados">
            <StatusHistory entradas={reparacion.statusHistory} />
          </Seccion>

          <Seccion titulo="Historial de asignaciones">
            <AssignmentHistory entradas={reparacion.assignmentHistory} />
          </Seccion>
        </>
      ) : null}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
      {children}
    </p>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {etiqueta}
      </dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}
