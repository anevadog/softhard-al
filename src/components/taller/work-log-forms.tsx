"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import {
  ficharEntradaGeneralAction,
  ficharEntradaReparacionAction,
  ficharSalidaAction,
} from "@/server/actions/work-logs";

type AccionFormulario = (prev: FormState, formData: FormData) => Promise<FormState>;

const botonPrincipal =
  "inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60";

const textareaClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

/** Estado y envío comunes: `onSubmit` + `useTransition`, como el resto del proyecto. */
function useEnvio(accion: AccionFormulario) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await accion(state, formData);

      setState(resultado);
    });
  }

  return { state, pending, alEnviar };
}

function ErrorFormulario({ state }: { state: FormState }) {
  return state.status === "error" && state.message ? (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {state.message}
    </p>
  ) : null;
}

export function EntradaReparacionForm({ requestId }: { requestId: string }) {
  const { state, pending, alEnviar } = useEnvio(ficharEntradaReparacionAction);

  return (
    <form onSubmit={alEnviar} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <ErrorFormulario state={state} />
      <button type="submit" disabled={pending} className={botonPrincipal}>
        {pending ? "Fichando…" : "Fichar entrada"}
      </button>
    </form>
  );
}

export function SalidaForm({
  workLogId,
  origen,
}: {
  workLogId: string;
  origen: "inicio" | "reparacion";
}) {
  const { state, pending, alEnviar } = useEnvio(ficharSalidaAction);

  return (
    <form onSubmit={alEnviar} className="space-y-2">
      <input type="hidden" name="workLogId" value={workLogId} />
      <input type="hidden" name="origen" value={origen} />
      <ErrorFormulario state={state} />
      <button type="submit" disabled={pending} className={botonPrincipal}>
        {pending ? "Fichando…" : "Fichar salida"}
      </button>
    </form>
  );
}

export function EntradaGeneralForm() {
  const { state, pending, alEnviar } = useEnvio(ficharEntradaGeneralAction);
  const [nota, setNota] = useState("");
  const error = state.fieldErrors?.nota?.[0];

  return (
    <form onSubmit={alEnviar} className="space-y-3" noValidate>
      <ErrorFormulario state={state} />
      <div>
        <label htmlFor="nota-fichaje" className="block text-sm font-medium text-slate-700">
          Horas generales <span className="font-normal text-slate-500">(nota obligatoria)</span>
        </label>
        <textarea
          id="nota-fichaje"
          name="nota"
          rows={2}
          maxLength={500}
          value={nota}
          onChange={(event) => setNota(event.target.value)}
          placeholder="Por ejemplo: inventario, limpieza del taller…"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "nota-fichaje-error" : undefined}
          className={textareaClass}
        />
        {error ? (
          <p id="nota-fichaje-error" className="mt-1.5 text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={pending} className={botonPrincipal}>
        {pending ? "Fichando…" : "Fichar entrada en horas generales"}
      </button>
    </form>
  );
}
