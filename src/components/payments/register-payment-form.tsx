"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import {
  MAX_NOTA_COBRO,
  METODOS_PAGO_MANUAL,
  PAYMENT_METHOD_LABELS,
} from "@/lib/payments";
import { registrarCobroAction } from "@/server/actions/payments";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 read-only:bg-slate-50 read-only:text-slate-600";

/** Importe como texto con coma decimal, como lo escribiría el staff. */
function importeComoTexto(importe: number): string {
  return importe.toFixed(2).replace(".", ",");
}

/**
 * "Registrar pago manual": el mismo formulario para pedidos y solicitudes. El
 * importe llega pre-rellenado con el esperado; solo `admin` puede cambiarlo, y
 * entonces la nota pasa a ser el motivo obligatorio. El servidor revalida todo.
 */
export function RegisterPaymentForm({
  entidad,
  id,
  importeEsperado,
  puedeEditarImporte,
}: {
  entidad: "pedido" | "solicitud";
  id: string;
  importeEsperado: number;
  puedeEditarImporte: boolean;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const textoEsperado = importeComoTexto(importeEsperado);
  const [importe, setImporte] = useState(textoEsperado);
  const [nota, setNota] = useState("");

  const importeCambiado = importe.trim() !== textoEsperado;

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await registrarCobroAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-3" noValidate>
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value={id} />

      <div>
        <label htmlFor="importe" className="block text-sm font-medium text-slate-700">
          Importe cobrado (€, IVA incluido)
        </label>
        <input
          id="importe"
          name="importe"
          inputMode="decimal"
          value={importe}
          readOnly={!puedeEditarImporte}
          onChange={(event) => setImporte(event.target.value)}
          className={inputClass}
          aria-invalid={Boolean(state.fieldErrors?.importe)}
        />
        {state.fieldErrors?.importe?.[0] ? (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.importe[0]}</p>
        ) : puedeEditarImporte ? (
          <p className="mt-1 text-xs text-slate-500">
            Esperado: {textoEsperado} €. Cambiarlo exige explicar el motivo en la nota.
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Solo un administrador puede cambiar el importe.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="metodo" className="block text-sm font-medium text-slate-700">
          Método de pago
        </label>
        <select
          id="metodo"
          name="metodo"
          required
          defaultValue=""
          className={inputClass}
          aria-invalid={Boolean(state.fieldErrors?.metodo)}
        >
          <option value="" disabled>
            Elige cómo se ha cobrado
          </option>
          {METODOS_PAGO_MANUAL.map((metodo) => (
            <option key={metodo} value={metodo}>
              {PAYMENT_METHOD_LABELS[metodo]}
            </option>
          ))}
        </select>
        {state.fieldErrors?.metodo?.[0] ? (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.metodo[0]}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="nota" className="block text-sm font-medium text-slate-700">
          {importeCambiado ? "Motivo del cambio de importe" : "Nota"}{" "}
          <span className="font-normal text-slate-500">
            {importeCambiado ? "(obligatorio)" : "(opcional)"}
          </span>
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={2}
          maxLength={MAX_NOTA_COBRO}
          required={importeCambiado}
          value={nota}
          onChange={(event) => setNota(event.target.value)}
          placeholder={
            importeCambiado
              ? "Explica por qué se cobra otro importe"
              : "Por ejemplo, referencia de la transferencia"
          }
          className={inputClass}
        />
      </div>

      {state.status === "error" && state.message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Registrando…" : "Registrar pago"}
      </button>
    </form>
  );
}
