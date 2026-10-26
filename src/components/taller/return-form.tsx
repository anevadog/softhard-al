"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { devolverSolicitudAction } from "@/server/actions/assignments";

const textareaClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

export function ReturnForm({ requestId }: { requestId: string }) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState("");

  const error = state.fieldErrors?.motivo?.[0];

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await devolverSolicitudAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <details className="group rounded-lg border border-slate-200">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700">
        Devolver al encargado
      </summary>

      <form onSubmit={alEnviar} className="space-y-3 border-t border-slate-100 px-4 py-4" noValidate>
        <input type="hidden" name="requestId" value={requestId} />

        {state.status === "error" && state.message ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}

        <div>
          <label htmlFor="motivo-devolucion" className="block text-sm font-medium text-slate-700">
            Motivo <span className="font-normal text-slate-500">(obligatorio)</span>
          </label>
          <textarea
            id="motivo-devolucion"
            name="motivo"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Explica por qué la devuelves"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "motivo-devolucion-error" : undefined}
            className={textareaClass}
          />
          {error ? (
            <p id="motivo-devolucion-error" className="mt-1.5 text-xs text-red-600">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-lg border border-red-200 px-5 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
        >
          {pending ? "Devolviendo…" : "Devolver reparación"}
        </button>

        <p className="text-xs text-slate-500">
          Conserva su estado y queda sin responsable hasta que el encargado la
          reasigne. Si tienes un fichaje abierto en ella, se cierra.
        </p>
      </form>
    </details>
  );
}
