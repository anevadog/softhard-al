"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { decidirPresupuestoAction } from "@/server/actions/service-requests";

export function QuoteDecision({ requestId }: { requestId: string }) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    // La decisión va en el botón pulsado: FormData(form) no incluye el submitter.
    const boton = (event.nativeEvent as SubmitEvent).submitter;

    if (boton instanceof HTMLButtonElement && boton.name) {
      formData.set(boton.name, boton.value);
    }

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await decidirPresupuestoAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="mt-4 space-y-3">
      <input type="hidden" name="requestId" value={requestId} />

      {state.status === "error" && state.message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          name="decision"
          value="aceptar"
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Procesando…" : "Aceptar presupuesto"}
        </button>

        <button
          type="submit"
          name="decision"
          value="rechazar"
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          Rechazar presupuesto
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Si aceptas, abonas el presupuesto menos la tarifa de diagnóstico. Si
        rechazas, solo abonas la tarifa de diagnóstico.
      </p>
    </form>
  );
}
