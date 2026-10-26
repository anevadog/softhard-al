"use client";

import { useActionState, useState } from "react";

import type { ServiceStatus } from "@/generated/prisma/enums";
import { FORM_STATE_INICIAL } from "@/lib/form-state";
import { SERVICE_STATUS_META } from "@/lib/service-requests";
import {
  opcionesCambioEstado,
  type RolTaller,
} from "@/lib/service-status";
import { cambiarEstadoAction } from "@/server/actions/admin-requests";

const selectClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

const textareaClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

export function StatusForm({
  requestId,
  status,
  role,
  tienePresupuesto,
}: {
  requestId: string;
  status: ServiceStatus;
  role: RolTaller;
  tienePresupuesto: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    cambiarEstadoAction,
    FORM_STATE_INICIAL,
  );

  const opciones = opcionesCambioEstado({
    actual: status,
    rol: role,
    asignadaAlTrabajador: true,
    tienePresupuesto,
  });

  const opcionInicial =
    opciones.find((opcion) => !opcion.requiereMotivo) ?? opciones[0];

  const [estadoNuevo, setEstadoNuevo] = useState<ServiceStatus | "">(
    opcionInicial?.estado ?? "",
  );

  const estadoSeleccionado = opciones.some(
    (opcion) => opcion.estado === estadoNuevo,
  )
    ? estadoNuevo
    : (opcionInicial?.estado ?? "");

  const opcionSeleccionada = opciones.find(
    (opcion) => opcion.estado === estadoSeleccionado,
  );

  if (opciones.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No hay cambios de estado disponibles para tu rol en este momento.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="estadoEsperado" value={status} />

      <div>
        <label
          htmlFor="estadoNuevo"
          className="block text-sm font-medium text-slate-700"
        >
          Estado actual: {SERVICE_STATUS_META[status].label}
        </label>
        <select
          id="estadoNuevo"
          name="estadoNuevo"
          value={estadoSeleccionado}
          onChange={(event) => setEstadoNuevo(event.target.value as ServiceStatus)}
          className={selectClass}
        >
          {opciones.map((opcion) => (
            <option key={opcion.estado} value={opcion.estado}>
              {SERVICE_STATUS_META[opcion.estado].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="motivo" className="block text-sm font-medium text-slate-700">
          Motivo{" "}
          <span className="font-normal text-slate-500">
            {opcionSeleccionada?.requiereMotivo ? "(obligatorio)" : "(opcional)"}
          </span>
        </label>
        <textarea
          id="motivo"
          name="motivo"
          rows={2}
          maxLength={500}
          required={opcionSeleccionada?.requiereMotivo}
          placeholder={
            opcionSeleccionada?.requiereMotivo
              ? "Explica por qué corriges el estado"
              : "Puedes dejar una nota"
          }
          className={textareaClass}
        />
        {opcionSeleccionada?.requiereMotivo ? (
          <p className="mt-1 text-xs text-amber-700">
            Corregir el flujo normal exige un motivo.
          </p>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Cambiar estado"}
      </button>

      <p className="text-xs text-slate-500">
        Aceptada y rechazada exigen un presupuesto creado.
      </p>
    </form>
  );
}
