"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import {
  MAX_MOTIVO_RECTIFICATIVA,
  MAX_MOTIVO_REEMISION,
} from "@/lib/invoices";
import {
  emitirRectificativaAction,
  reemitirFacturaAction,
} from "@/server/actions/invoices";

const textareaClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

function useAccion(
  accion: (estado: FormState, datos: FormData) => Promise<FormState>,
) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      setState(await accion(state, formData));
    });
  }

  return { state, pending, alEnviar };
}

function Errores({ state, campo }: { state: FormState; campo: string }) {
  const error = state.fieldErrors?.[campo]?.[0];

  return (
    <>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
      {state.status === "error" && state.message && !error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </>
  );
}

/** Rectificativa total con motivo obligatorio. */
export function RectifyInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const { state, pending, alEnviar } = useAccion(emitirRectificativaAction);

  return (
    <form onSubmit={alEnviar} className="space-y-3" noValidate>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div>
        <label htmlFor="motivo-rectificativa" className="block text-sm font-medium text-slate-700">
          Motivo de la rectificativa
        </label>
        <textarea
          id="motivo-rectificativa"
          name="motivo"
          rows={2}
          required
          maxLength={MAX_MOTIVO_RECTIFICATIVA}
          placeholder="Por ejemplo, cliente con NIF erróneo o cancelación del pedido"
          className={textareaClass}
        />
        <Errores state={state} campo="motivo" />
      </div>
      <p className="text-xs text-slate-500">
        Anula la factura entera con una nueva en negativo. No cambia el cobro ni el estado.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg border border-rose-300 px-5 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-60"
      >
        {pending ? "Emitiendo…" : "Emitir rectificativa"}
      </button>
    </form>
  );
}

/** "Emitir factura de nuevo" con los datos actuales del cliente. */
export function ReissueInvoiceForm({
  entidad,
  id,
}: {
  entidad: "pedido" | "solicitud";
  id: string;
}) {
  const { state, pending, alEnviar } = useAccion(reemitirFacturaAction);

  return (
    <form onSubmit={alEnviar} className="space-y-3 border-t border-slate-100 pt-4" noValidate>
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="motivo-reemision" className="block text-sm font-medium text-slate-700">
          Motivo de la nueva factura
        </label>
        <textarea
          id="motivo-reemision"
          name="motivo"
          rows={2}
          required
          maxLength={MAX_MOTIVO_REEMISION}
          placeholder="Por ejemplo, el cliente ha corregido su NIF"
          className={textareaClass}
        />
        <Errores state={state} campo="motivo" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Emitiendo…" : "Emitir factura de nuevo"}
      </button>
    </form>
  );
}
