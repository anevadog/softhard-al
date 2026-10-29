"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { actualizarNifAction } from "@/server/actions/invoices";

/** NIF del cliente: vacío lo borra y las facturas pasan a ser simplificadas. */
export function NifForm({ nifActual }: { nifActual: string | null }) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      setState(await actualizarNifAction(state, formData));
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-3" noValidate>
      <div>
        <label htmlFor="nif" className="block text-sm font-medium text-slate-700">
          NIF, NIE o CIF <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <input
          id="nif"
          name="nif"
          defaultValue={nifActual ?? ""}
          autoComplete="off"
          maxLength={20}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          aria-invalid={Boolean(state.fieldErrors?.nif)}
        />
        {state.fieldErrors?.nif?.[0] ? (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.nif[0]}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Con NIF tus facturas serán completas; sin él, simplificadas. Las ya emitidas no cambian.
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
