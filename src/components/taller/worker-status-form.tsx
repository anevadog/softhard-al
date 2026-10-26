"use client";

import { useState, useTransition, type FormEvent } from "react";

import type { ServiceStatus } from "@/generated/prisma/enums";
import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { accionesEstadoTrabajador } from "@/lib/worker-requests";
import { cambiarEstadoAction } from "@/server/actions/admin-requests";

/**
 * Un botón por transición del flujo normal del trabajador. Cada botón es su
 * propio formulario con el estado esperado, de modo que una pestaña
 * desactualizada recibe un conflicto en lugar de pisar el cambio de otro.
 */
export function WorkerStatusForm({
  requestId,
  status,
}: {
  requestId: string;
  status: ServiceStatus;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const acciones = accionesEstadoTrabajador(status);

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await cambiarEstadoAction(state, formData);

      setState(resultado);
    });
  }

  if (acciones.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        {status === "lista"
          ? "Reparación lista. El encargado marcará la entrega."
          : "No hay cambios de estado disponibles en este momento."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {state.status === "error" && state.message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {acciones.map((accion, indice) => (
          <form key={accion.estado} onSubmit={alEnviar}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="estadoEsperado" value={status} />
            <input type="hidden" name="estadoNuevo" value={accion.estado} />
            <button
              type="submit"
              disabled={pending}
              className={
                indice === 0
                  ? "inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                  : "inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              }
            >
              {pending ? "Guardando…" : accion.etiqueta}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
