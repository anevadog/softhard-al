"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { formatEuros } from "@/lib/format";
import {
  calcularImporteSiAcepta,
  calcularImporteSiRechaza,
} from "@/lib/quotes";
import { crearPresupuestoAction } from "@/server/actions/admin-requests";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

export function QuoteForm({
  requestId,
  diagnosticFee,
}: {
  requestId: string;
  diagnosticFee: number;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [importe, setImporte] = useState("");

  const numero = Number(importe.replace(",", "."));
  const parseado = importe.trim() !== "" && Number.isFinite(numero) && numero > 0;
  const previsto =
    parseado && numero >= diagnosticFee
      ? calcularImporteSiAcepta(numero, diagnosticFee)
      : null;

  const error = state.fieldErrors?.budgetAmount?.[0];

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await crearPresupuestoAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-4" noValidate>
      <input type="hidden" name="requestId" value={requestId} />

      {state.status === "error" && state.message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="budgetAmount" className="block text-sm font-medium text-slate-700">
          Importe del presupuesto (€)
        </label>
        <input
          id="budgetAmount"
          name="budgetAmount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="120,50"
          value={importe}
          onChange={(event) => setImporte(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "budgetAmount-error" : "budgetAmount-hint"}
          className={inputClass}
        />
        {error ? (
          <p id="budgetAmount-error" className="mt-1.5 text-xs text-red-600">
            {error}
          </p>
        ) : (
          <p id="budgetAmount-hint" className="mt-1.5 text-xs text-slate-500">
            Tarifa de diagnóstico: {formatEuros(diagnosticFee)}. Se descuenta del
            importe si el cliente acepta.
          </p>
        )}
      </div>

      <dl className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600">Importe final si acepta</dt>
          <dd className="font-semibold text-slate-900">
            {previsto === null ? "—" : formatEuros(previsto)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600">Importe final si rechaza</dt>
          <dd className="text-slate-700">
            {formatEuros(calcularImporteSiRechaza(diagnosticFee))}
          </dd>
        </div>
      </dl>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Crear presupuesto"}
      </button>
    </form>
  );
}
