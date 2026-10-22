import type { QuoteStatus } from "@/generated/prisma/enums";
import { formatearFechaCorta, formatEuros } from "@/lib/format";
import { QUOTE_STATUS_LABELS } from "@/lib/service-requests";

/** Campos comunes al presupuesto del panel y al del cliente. */
type PresupuestoResumen = {
  budgetAmount: number;
  diagnosticFee: number;
  finalAmount: number | null;
  status: QuoteStatus;
  expiresAt: Date;
};

export function QuoteSummary({ quote }: { quote: PresupuestoResumen }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600">Presupuesto</dt>
          <dd className="font-medium text-slate-900">
            {formatEuros(quote.budgetAmount)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600">Tarifa de diagnóstico</dt>
          <dd className="text-slate-700">− {formatEuros(quote.diagnosticFee)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
          <dt className="font-medium text-slate-900">Importe final</dt>
          <dd className="font-semibold text-slate-900">
            {quote.finalAmount === null || quote.status === "expirado"
              ? "—"
              : formatEuros(quote.finalAmount)}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-slate-500">
        {QUOTE_STATUS_LABELS[quote.status]}
        {quote.status === "pendiente"
          ? ` · Expira el ${formatearFechaCorta(quote.expiresAt)}`
          : quote.status === "expirado"
            ? ` · Caducó el ${formatearFechaCorta(quote.expiresAt)}`
            : null}
      </p>
    </div>
  );
}
