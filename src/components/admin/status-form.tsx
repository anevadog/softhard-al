"use client";

import { useState, useTransition, type FormEvent } from "react";

import type { ServiceStatus } from "@/generated/prisma/enums";
import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
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
  entregaRequierePago = false,
  facturaVigente = false,
}: {
  requestId: string;
  status: ServiceStatus;
  role: RolTaller;
  tienePresupuesto: boolean;
  /** Hay importe que cobrar y no hay cobro: "Entregada" sale deshabilitada. */
  entregaRequierePago?: boolean;
  /** Con factura vigente solo se permite entregar; el resto exige rectificar antes. */
  facturaVigente?: boolean;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState("");

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await cambiarEstadoAction(state, formData);

      setState(resultado);
    });
  }

  const opciones = opcionesCambioEstado({
    actual: status,
    rol: role,
    asignadaAlTrabajador: true,
    tienePresupuesto,
  });

  // La UI no es la seguridad: el servidor rechaza igualmente entregar sin cobro.
  const bloqueada = (estado: ServiceStatus) =>
    (entregaRequierePago && estado === "entregada") ||
    (facturaVigente && estado !== "entregada");
  const seleccionables = opciones.filter((opcion) => !bloqueada(opcion.estado));

  // Si el único paso normal era entregar y está bloqueado, no se preselecciona
  // ninguna corrección: hay que elegirla a propósito.
  const opcionInicial =
    seleccionables.find((opcion) => !opcion.requiereMotivo) ??
    (entregaRequierePago || facturaVigente ? undefined : seleccionables[0]);

  const [estadoNuevo, setEstadoNuevo] = useState<ServiceStatus | "">(
    opcionInicial?.estado ?? "",
  );

  const estadoSeleccionado = seleccionables.some(
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
    <form onSubmit={alEnviar} className="space-y-3">
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
          {estadoSeleccionado === "" ? (
            <option value="" disabled>
              Elige un estado
            </option>
          ) : null}
          {opciones.map((opcion) => (
            <option
              key={opcion.estado}
              value={opcion.estado}
              disabled={bloqueada(opcion.estado)}
              title={
                bloqueada(opcion.estado)
                  ? opcion.estado === "entregada"
                    ? "Requiere pago"
                    : "Tiene factura vigente"
                  : undefined
              }
            >
              {SERVICE_STATUS_META[opcion.estado].label}
              {bloqueada(opcion.estado)
                ? opcion.estado === "entregada"
                  ? " (requiere pago)"
                  : " (factura vigente)"
                : ""}
            </option>
          ))}
        </select>
        {entregaRequierePago && opciones.some((opcion) => opcion.estado === "entregada") ? (
          <p className="mt-1 text-xs text-amber-700" title="Requiere pago">
            Para entregar, registra antes el pago en la sección Cobro.
          </p>
        ) : null}
        {facturaVigente ? (
          <p className="mt-1 text-xs text-amber-700">
            Tiene factura vigente: emite antes la rectificativa para corregir el estado.
          </p>
        ) : null}
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
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
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
        disabled={pending || !opcionSeleccionada}
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
