import Link from "next/link";

import type { EmailEvent, EmailStatus } from "@/generated/prisma/enums";
import { formatearFechaHora } from "@/lib/format";
import { reintentarEmailAction } from "@/server/actions/emails";
import { requerirStaff } from "@/server/authorization";
import { TAMANO_LISTADO_EMAILS, listarEmailsAdmin } from "@/server/data/emails";

export const metadata = {
  title: "Emails",
};

const ESTADOS: readonly EmailStatus[] = ["pendiente", "enviando", "enviado", "fallido"];

const ESTADO_META: Record<EmailStatus, { label: string; badgeClass: string }> = {
  pendiente: { label: "Pendiente", badgeClass: "bg-amber-50 text-amber-700 ring-amber-200" },
  enviando: { label: "Enviando", badgeClass: "bg-sky-50 text-sky-700 ring-sky-200" },
  enviado: { label: "Enviado", badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  fallido: { label: "Fallido", badgeClass: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const EVENTO_LABELS: Record<EmailEvent, string> = {
  pedido_confirmado: "Pedido confirmado",
  presupuesto_listo: "Presupuesto listo",
  reparacion_lista: "Reparación lista",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  await requerirStaff();

  const filtro = ESTADOS.find((valor) => valor === estado);
  const { emails, conteos } = await listarEmailsAdmin(filtro);
  const total = Object.values(conteos).reduce((suma, valor) => suma + valor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Emails</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cola de emails transaccionales. Cada evento encola su email al confirmarse; el
          worker (<code className="text-xs">npm run worker:emails</code>) los envía y reintenta
          hasta 5 veces.
        </p>
      </div>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2 text-sm">
        <FiltroLink href="/admin/emails" activo={!filtro} etiqueta="Todos" total={total} />
        {ESTADOS.map((valor) => (
          <FiltroLink
            key={valor}
            href={`/admin/emails?estado=${valor}`}
            activo={filtro === valor}
            etiqueta={ESTADO_META[valor].label}
            total={conteos[valor]}
          />
        ))}
      </nav>

      {emails.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No hay emails {filtro ? `en estado «${ESTADO_META[filtro].label.toLowerCase()}»` : "en la cola"}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Destinatario</th>
                <th className="px-4 py-3 font-medium">Encolado</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emails.map((email) => (
                <tr key={email.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{email.subject}</p>
                    <p className="text-xs text-slate-500">{EVENTO_LABELS[email.event]}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{email.to}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatearFechaHora(email.createdAt)}
                    {email.sentAt ? (
                      <p className="text-xs text-slate-500">Enviado {formatearFechaHora(email.sentAt)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${ESTADO_META[email.status].badgeClass}`}
                    >
                      {ESTADO_META[email.status].label}
                    </span>
                    {email.attempts > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">{email.attempts} intentos</p>
                    ) : null}
                    {email.lastError && email.status !== "enviado" ? (
                      <p className="mt-1 max-w-xs break-words text-xs text-rose-700">{email.lastError}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {email.status === "fallido" ? (
                      <form action={reintentarEmailAction}>
                        <input type="hidden" name="id" value={email.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          Reintentar
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {emails.length === TAMANO_LISTADO_EMAILS ? (
        <p className="text-xs text-slate-500">Se muestran los {TAMANO_LISTADO_EMAILS} más recientes.</p>
      ) : null}
    </div>
  );
}

function FiltroLink({
  href,
  activo,
  etiqueta,
  total,
}: {
  href: string;
  activo: boolean;
  etiqueta: string;
  total: number;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 transition-colors ${
        activo
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {etiqueta}
      <span className={activo ? "text-slate-300" : "text-slate-400"}>{total}</span>
    </Link>
  );
}
