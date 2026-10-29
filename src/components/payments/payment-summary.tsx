import { formatearFechaHora, formatEuros } from "@/lib/format";
import { etiquetaMetodoPago, type CobroRegistrado } from "@/lib/payments";

/** Resumen de un cobro ya registrado, para los detalles del panel. */
export function PaymentSummary({ cobro }: { cobro: CobroRegistrado }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Cobrado el</dt>
        <dd className="text-right font-medium text-slate-900">
          {formatearFechaHora(cobro.paidAt)}
        </dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Importe</dt>
        <dd className="font-semibold text-slate-950">{formatEuros(cobro.paidAmount)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Método</dt>
        <dd className="text-slate-900">{etiquetaMetodoPago(cobro.paymentMethod)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-slate-500">Registrado por</dt>
        <dd className="text-slate-900">{cobro.paidByName ?? "Sistema"}</dd>
      </div>
      {cobro.paymentNote ? (
        <div>
          <dt className="text-slate-500">Nota</dt>
          <dd className="mt-1 whitespace-pre-line text-slate-700">{cobro.paymentNote}</dd>
        </div>
      ) : null}
    </dl>
  );
}
