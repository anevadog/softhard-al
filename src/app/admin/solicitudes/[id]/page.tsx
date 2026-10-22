import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { QuoteForm } from "@/components/admin/quote-form";
import { QuoteSummary } from "@/components/admin/quote-summary";
import { StatusForm } from "@/components/admin/status-form";
import { StatusBadge } from "@/components/service-requests/status-badge";
import { formatearFechaCorta } from "@/lib/format";
import {
  EQUIPMENT_LABELS,
  MODALITY_LABELS,
  TIME_SLOT_LABELS,
} from "@/lib/service-requests";
import {
  obtenerConfig,
  obtenerSolicitudAdmin,
} from "@/server/data/admin-requests";

export const metadata = {
  title: "Detalle de solicitud",
};

export default async function AdminSolicitudPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ presupuesto?: string; estado?: string }>;
}) {
  const { id } = await params;
  const { presupuesto, estado } = await searchParams;
  const solicitud = await obtenerSolicitudAdmin(id);

  if (!solicitud) {
    notFound();
  }

  const config = await obtenerConfig();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/solicitudes"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver a solicitudes
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {EQUIPMENT_LABELS[solicitud.equipmentType]} · {solicitud.brand}{" "}
            {solicitud.model}
          </h1>
          <StatusBadge status={solicitud.status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Recibida el {formatearFechaCorta(solicitud.createdAt)} ·{" "}
          {solicitud.client.name}
        </p>
      </div>

      {presupuesto === "1" ? (
        <p
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Presupuesto creado. La solicitud pasa a diagnosticada.
        </p>
      ) : null}

      {estado === "1" ? (
        <p
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Estado actualizado.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Equipo y problema
            </h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Dato etiqueta="Tipo">
                {EQUIPMENT_LABELS[solicitud.equipmentType]}
              </Dato>
              <Dato etiqueta="Marca y modelo">
                {solicitud.brand} {solicitud.model}
              </Dato>
              <Dato etiqueta="Modalidad">
                {MODALITY_LABELS[solicitud.modality]}
              </Dato>
              <Dato etiqueta="Franja horaria">
                {TIME_SLOT_LABELS[solicitud.timeSlot]}
              </Dato>
            </dl>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Problema descrito
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {solicitud.issue}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Cliente</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Dato etiqueta="Nombre">{solicitud.client.name}</Dato>
              <Dato etiqueta="Email">{solicitud.client.email}</Dato>
              <Dato etiqueta="Teléfono">
                {solicitud.client.phone ?? "No indicado"}
              </Dato>
              <Dato etiqueta="Caducidad">
                {solicitud.expiresAt
                  ? formatearFechaCorta(solicitud.expiresAt)
                  : "Sin presupuesto"}
              </Dato>
            </dl>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Presupuesto</h2>

            {solicitud.quote ? (
              <div className="mt-4">
                <QuoteSummary quote={solicitud.quote} />
              </div>
            ) : config ? (
              <div className="mt-4">
                <QuoteForm
                  requestId={solicitud.id}
                  diagnosticFee={config.diagnosticFee}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-red-600">
                No hay configuración de tarifas. Ejecuta el seed para poder crear
                presupuestos.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Estado de la solicitud
            </h2>
            <div className="mt-4">
              <StatusForm requestId={solicitud.id} status={solicitud.status} />
            </div>
          </section>
        </div>
      </div>
    </div>
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
