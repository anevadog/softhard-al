import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { QuoteDecision } from "@/components/service-requests/quote-decision";
import { QuoteSummary } from "@/components/service-requests/quote-summary";
import { StatusBadge } from "@/components/service-requests/status-badge";
import { InvoiceChain } from "@/components/invoices/invoice-chain";
import { auth } from "@/lib/auth";
import { formatearFechaCorta, formatEuros } from "@/lib/format";
import { estaExpirado, puedeDecidir } from "@/lib/quotes";
import {
  EQUIPMENT_LABELS,
  MODALITY_LABELS,
  TIME_SLOT_LABELS,
} from "@/lib/service-requests";
import { obtenerSolicitudCliente } from "@/server/data/service-requests";
import { listarFacturasDeEntidad } from "@/server/data/invoices";

export const metadata = {
  title: "Detalle de solicitud",
};

export default async function SolicitudClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ decision?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/app/solicitudes");
  }

  const { id } = await params;
  const { decision } = await searchParams;
  const solicitud = await obtenerSolicitudCliente(id, session.user.id);

  if (!solicitud) {
    notFound();
  }

  const facturas = await listarFacturasDeEntidad({ tipo: "solicitud", id: solicitud.id });

  const quote = solicitud.quote;
  const ahora = new Date();
  const puedeDecidirAhora =
    quote !== null &&
    puedeDecidir(solicitud.status, quote.status, quote.expiresAt, ahora);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/solicitudes"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver a mis solicitudes
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {EQUIPMENT_LABELS[solicitud.equipmentType]} · {solicitud.brand}{" "}
            {solicitud.model}
          </h1>
          <StatusBadge status={solicitud.status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Solicitud creada el {formatearFechaCorta(solicitud.createdAt)}
          {solicitud.paidAt
            ? ` · Pagado el ${formatearFechaCorta(solicitud.paidAt)}`
            : null}
        </p>
      </div>

      {decision === "aceptada" ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          Has aceptado el presupuesto. El taller se pondrá en marcha con la
          reparación.
        </p>
      ) : null}

      {decision === "rechazada" ? (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700" role="status">
          Has rechazado el presupuesto. Solo abonas la tarifa de diagnóstico.
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
              {solicitud.modality === "domicilio" ? (
                <Dato etiqueta="Dirección de recogida">
                  {solicitud.address ?? "No indicada"}
                </Dato>
              ) : null}
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
            <h2 className="text-base font-semibold text-slate-900">
              Cómo funciona el presupuesto
            </h2>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              <li>
                1. El taller revisa tu equipo y prepara un presupuesto cerrado.
              </li>
              <li>
                2. Puedes aceptarlo o rechazarlo mientras esté vigente.
              </li>
              <li>
                3. Si lo aceptas, abonas el importe menos la tarifa de
                diagnóstico. Si lo rechazas, solo abonas esa tarifa.
              </li>
            </ol>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {facturas.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">Facturas</h2>
              <div className="mt-3">
                <InvoiceChain facturas={facturas} rutaFacturas="/app/facturas" />
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">Presupuesto</h2>

            {quote === null ? (
              <p className="mt-4 text-sm text-slate-600">
                El taller todavía está revisando tu solicitud. Cuando haya un
                presupuesto aparecerá aquí.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <QuoteSummary quote={quote} />

                {quote.status === "pendiente" && puedeDecidirAhora ? (
                  <QuoteDecision requestId={solicitud.id} />
                ) : null}

                {quote.status === "pendiente" && !puedeDecidirAhora ? (
                  <Aviso tono="amber">
                    {estaExpirado(quote.expiresAt, ahora)
                      ? `El presupuesto caducó el ${formatearFechaCorta(
                          quote.expiresAt,
                        )}. Contacta con el taller para pedir uno nuevo.`
                      : "El taller está gestionando tu solicitud y el presupuesto ya no admite cambios."}
                  </Aviso>
                ) : null}

                {quote.status === "aceptado" ? (
                  <Aviso tono="emerald">
                    Aceptaste el presupuesto
                    {quote.decidedAt
                      ? ` el ${formatearFechaCorta(quote.decidedAt)}`
                      : ""}
                    . Importe a abonar:{" "}
                    {quote.finalAmount === null
                      ? "—"
                      : formatEuros(quote.finalAmount)}
                    .
                  </Aviso>
                ) : null}

                {quote.status === "rechazado" ? (
                  <Aviso tono="slate">
                    Rechazaste el presupuesto
                    {quote.decidedAt
                      ? ` el ${formatearFechaCorta(quote.decidedAt)}`
                      : ""}
                    . Solo abonas la tarifa de diagnóstico:{" "}
                    {quote.finalAmount === null
                      ? formatEuros(quote.diagnosticFee)
                      : formatEuros(quote.finalAmount)}
                    .
                  </Aviso>
                ) : null}

                {quote.status === "expirado" ? (
                  <Aviso tono="amber">
                    El presupuesto caducó el{" "}
                    {formatearFechaCorta(quote.expiresAt)}. Contacta con el
                    taller para pedir uno nuevo.
                  </Aviso>
                ) : null}
              </div>
            )}
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

const TONOS = {
  amber: "bg-amber-50 text-amber-800",
  emerald: "bg-emerald-50 text-emerald-800",
  slate: "bg-slate-100 text-slate-700",
} as const;

function Aviso({
  tono,
  children,
}: {
  tono: keyof typeof TONOS;
  children: ReactNode;
}) {
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${TONOS[tono]}`} role="status">
      {children}
    </p>
  );
}
