"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { marcarNotaAtendidaAction } from "@/server/actions/request-notes";

export function ResolveNoteForm({ noteId }: { noteId: string }) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await marcarNotaAtendidaAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-2">
      <input type="hidden" name="noteId" value={noteId} />
      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-800 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Marcar atendida"}
      </button>
    </form>
  );
}
