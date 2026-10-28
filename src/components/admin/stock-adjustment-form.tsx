"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import {
  MAX_STOCK_NOTE_LENGTH,
  MAX_STOCK_VARIATION,
  STOCK_MOVEMENT_REASON_LABELS,
  type MotivoAjusteStock,
} from "@/lib/stock";
import { ajustarStockAction } from "@/server/actions/products";

const labelClass = "block text-sm font-medium text-slate-700";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

function parseVariacion(value: string): number | null {
  const limpio = value.trim();

  if (!/^-?\d+$/.test(limpio)) {
    return null;
  }

  const numero = Number(limpio);

  return Number.isSafeInteger(numero) ? numero : null;
}

export function StockAdjustmentForm({
  productId,
  stock,
}: {
  productId: string;
  stock: number;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<MotivoAjusteStock>("reposicion");
  const [variation, setVariation] = useState("");
  const [note, setNote] = useState("");
  const errors = state.fieldErrors ?? {};

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await ajustarStockAction(state, formData);

      setState(resultado);
    });
  }

  const variacion = parseVariacion(variation);
  const resultante = variacion === null ? null : stock + variacion;
  const dejariaNegativo = resultante !== null && resultante < 0;
  const reposicionNoPositiva =
    reason === "reposicion" && variacion !== null && variacion <= 0;
  const variacionFueraDeRango =
    variacion !== null && Math.abs(variacion) > MAX_STOCK_VARIATION;

  return (
    <form onSubmit={alEnviar} className="space-y-4" noValidate>
      <input type="hidden" name="productId" value={productId} />

      <div>
        <label htmlFor="reason" className={labelClass}>
          Motivo
        </label>
        <select
          id="reason"
          name="reason"
          value={reason}
          onChange={(event) =>
            setReason(event.target.value as MotivoAjusteStock)
          }
          className={inputClass}
        >
          <option value="reposicion">
            {STOCK_MOVEMENT_REASON_LABELS.reposicion}
          </option>
          <option value="ajuste">{STOCK_MOVEMENT_REASON_LABELS.ajuste}</option>
        </select>
      </div>

      <div>
        <label htmlFor="variation" className={labelClass}>
          Variación
        </label>
        <input
          id="variation"
          name="variation"
          type="text"
          inputMode="numeric"
          placeholder="10 o -3"
          autoComplete="off"
          value={variation}
          onChange={(event) => setVariation(event.target.value)}
          aria-invalid={Boolean(errors.variation) || dejariaNegativo}
          aria-describedby="variation-hint"
          className={inputClass}
        />
        <p id="variation-hint" className="mt-1.5 text-xs text-slate-500">
          Entero distinto de cero. La reposición debe ser positiva; el ajuste
          admite signo y exige nota. Máximo {MAX_STOCK_VARIATION} unidades.
        </p>
        {errors.variation?.[0] ? (
          <p className="mt-1.5 text-xs text-red-600">{errors.variation[0]}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Vista previa
        </p>
        <p className="mt-1 text-sm text-slate-700" aria-live="polite">
          <span className="font-semibold text-slate-900">{stock}</span>
          <span className="mx-2 text-slate-400">→</span>
          <span
            className={`font-semibold ${
              dejariaNegativo ? "text-red-600" : "text-slate-900"
            }`}
          >
            {resultante ?? "—"}
          </span>
          <span className="ml-1 text-slate-500">unidades</span>
        </p>
        {dejariaNegativo ? (
          <p className="mt-1 text-xs text-red-600">
            El ajuste dejaría el stock en negativo.
          </p>
        ) : reposicionNoPositiva ? (
          <p className="mt-1 text-xs text-red-600">
            Una reposición debe ser positiva.
          </p>
        ) : variacionFueraDeRango ? (
          <p className="mt-1 text-xs text-red-600">
            La variación supera el máximo permitido.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="note" className={labelClass}>
          Nota{" "}
          <span className="font-normal text-slate-400">
            {reason === "ajuste" ? "(obligatoria)" : "(opcional)"}
          </span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={MAX_STOCK_NOTE_LENGTH}
          required={reason === "ajuste"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            reason === "ajuste"
              ? "Explica el motivo del ajuste"
              : "Detalle opcional de la reposición"
          }
          aria-invalid={Boolean(errors.note)}
          className={inputClass}
        />
        {errors.note?.[0] ? (
          <p className="mt-1.5 text-xs text-red-600">{errors.note[0]}</p>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Aplicando…" : "Aplicar movimiento"}
      </button>
    </form>
  );
}
