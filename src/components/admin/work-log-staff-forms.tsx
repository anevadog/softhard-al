"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import {
  cerrarFichajeStaffAction,
  corregirFichajeStaffAction,
} from "@/server/actions/work-logs";

type Origen = "abiertos" | "solicitud";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

export function CerrarFichajeForm({ workLogId, origen }: { workLogId: string; origen: Origen }) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await cerrarFichajeStaffAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-2">
      <input type="hidden" name="workLogId" value={workLogId} />
      <input type="hidden" name="origen" value={origen} />
      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Cerrando…" : "Cerrar fichaje"}
      </button>
    </form>
  );
}

/**
 * Corrección de entrada, salida y nota. Las horas se escriben en hora de
 * Madrid. Un fichaje abierto no muestra la salida: se cierra con su botón.
 */
export function CorreccionFichajeForm({
  workLogId,
  origen,
  inicioInicial,
  finInicial,
  notaInicial,
  notaObligatoria,
}: {
  workLogId: string;
  origen: Origen;
  inicioInicial: string;
  finInicial: string | null;
  notaInicial: string;
  notaObligatoria: boolean;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [inicio, setInicio] = useState(inicioInicial);
  const [fin, setFin] = useState(finInicial ?? "");
  const [nota, setNota] = useState(notaInicial);
  const abierto = finInicial === null;

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await corregirFichajeStaffAction(state, formData);

      setState(resultado);
    });
  }

  const id = (campo: string) => `${campo}-${workLogId}`;

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-700">
        Corregir
      </summary>
      <form
        onSubmit={alEnviar}
        className="space-y-3 border-t border-slate-100 px-3 py-3"
        noValidate
      >
        <input type="hidden" name="workLogId" value={workLogId} />
        <input type="hidden" name="origen" value={origen} />

        {state.status === "error" && state.message ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("inicio")} className="block text-sm font-medium text-slate-700">
              Entrada
            </label>
            <input
              id={id("inicio")}
              name="inicio"
              type="datetime-local"
              value={inicio}
              onChange={(event) => setInicio(event.target.value)}
              className={inputClass}
            />
            {state.fieldErrors?.inicio?.[0] ? (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.inicio[0]}</p>
            ) : null}
          </div>

          {abierto ? null : (
            <div>
              <label htmlFor={id("fin")} className="block text-sm font-medium text-slate-700">
                Salida
              </label>
              <input
                id={id("fin")}
                name="fin"
                type="datetime-local"
                value={fin}
                onChange={(event) => setFin(event.target.value)}
                className={inputClass}
              />
              {state.fieldErrors?.fin?.[0] ? (
                <p className="mt-1 text-xs text-red-600">{state.fieldErrors.fin[0]}</p>
              ) : null}
            </div>
          )}
        </div>

        <div>
          <label htmlFor={id("nota")} className="block text-sm font-medium text-slate-700">
            Nota{" "}
            <span className="font-normal text-slate-500">
              {notaObligatoria ? "(obligatoria en horas generales)" : "(opcional)"}
            </span>
          </label>
          <textarea
            id={id("nota")}
            name="nota"
            rows={2}
            maxLength={500}
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar corrección"}
        </button>
        <p className="text-xs text-slate-500">
          Horas en zona de Madrid. Queda constancia de quién corrige y cuándo.
        </p>
      </form>
    </details>
  );
}
