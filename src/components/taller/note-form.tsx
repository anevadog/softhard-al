"use client";

import { useState, useTransition, type FormEvent } from "react";

import type { RequestNoteType } from "@/generated/prisma/enums";
import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { LONGITUD_MAXIMA_NOTA, NOTE_TYPE_LABELS, TIPOS_NOTA } from "@/lib/request-notes";
import { crearNotaAction } from "@/server/actions/request-notes";

const campoClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

/**
 * Nota interna para trabajador y staff. La acción decide las reglas según el
 * rol revalidado en servidor; `recordarEstado` muestra al trabajador que la
 * falta de repuesto no cambia el estado por sí sola.
 */
export function NoteForm({
  requestId,
  recordarEstado = false,
}: {
  requestId: string;
  recordarEstado?: boolean;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<RequestNoteType>("normal");
  const [texto, setTexto] = useState("");

  const error = state.fieldErrors?.texto?.[0];
  const idCampo = (campo: string) => `${campo}-${requestId}`;

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await crearNotaAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-3" noValidate>
      <input type="hidden" name="requestId" value={requestId} />

      {state.status === "error" && state.message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor={idCampo("tipo")} className="block text-sm font-medium text-slate-700">
          Tipo
        </label>
        <select
          id={idCampo("tipo")}
          name="tipo"
          value={tipo}
          onChange={(event) => setTipo(event.target.value as RequestNoteType)}
          className={campoClass}
        >
          {TIPOS_NOTA.map((valor) => (
            <option key={valor} value={valor}>
              {NOTE_TYPE_LABELS[valor]}
            </option>
          ))}
        </select>
        {tipo === "falta_repuesto" ? (
          <p className="mt-1.5 text-xs text-amber-700">
            Se destacará al encargado hasta que la marque como atendida.
            {recordarEstado
              ? " No cambia el estado: si paras la reparación, márcala también como «Esperando repuesto»."
              : ""}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={idCampo("texto")} className="block text-sm font-medium text-slate-700">
          Nota
        </label>
        <textarea
          id={idCampo("texto")}
          name="texto"
          rows={3}
          maxLength={LONGITUD_MAXIMA_NOTA}
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder={
            tipo === "falta_repuesto"
              ? "Qué pieza falta (modelo, referencia…)"
              : "Escribe la nota para el taller"
          }
          aria-invalid={Boolean(error)}
          aria-describedby={error ? idCampo("texto-error") : undefined}
          className={campoClass}
        />
        {error ? (
          <p id={idCampo("texto-error")} className="mt-1.5 text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Añadir nota"}
      </button>
    </form>
  );
}
