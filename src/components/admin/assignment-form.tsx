"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import type { TrabajadorAsignable } from "@/server/data/assignments";
import { asignarSolicitudAction } from "@/server/actions/assignments";

const selectClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

const textareaClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

export function AssignmentForm({
  requestId,
  currentAssignee,
  workers,
  finalizada,
}: {
  requestId: string;
  currentAssignee: { id: string; name: string } | null;
  workers: TrabajadorAsignable[];
  finalizada: boolean;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [assigneeId, setAssigneeId] = useState("");
  const [motivo, setMotivo] = useState("");

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await asignarSolicitudAction(state, formData);

      setState(resultado);
    });
  }

  if (finalizada) {
    return (
      <div className="space-y-3">
        <ResponsableActual currentAssignee={currentAssignee} />
        <p className="text-sm text-slate-600">
          No se puede asignar ni reasignar una reparación en estado final.
        </p>
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="space-y-3">
        <ResponsableActual currentAssignee={currentAssignee} />
        <p className="text-sm text-slate-600">
          No hay usuarios con rol trabajador para asignar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={alEnviar} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input
        type="hidden"
        name="assigneeEsperadoId"
        value={currentAssignee?.id ?? ""}
      />

      <ResponsableActual currentAssignee={currentAssignee} />

      <div>
        <label
          htmlFor="assigneeId"
          className="block text-sm font-medium text-slate-700"
        >
          {currentAssignee ? "Nuevo responsable" : "Responsable"}
        </label>
        <select
          id="assigneeId"
          name="assigneeId"
          required
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            Selecciona un trabajador
          </option>
          {workers.map((trabajador) => (
            <option key={trabajador.id} value={trabajador.id}>
              {trabajador.name}
              {trabajador.id === currentAssignee?.id ? " (actual)" : ""}
            </option>
          ))}
        </select>
        {state.fieldErrors?.assigneeId?.[0] ? (
          <p className="mt-1 text-xs text-red-600">
            {state.fieldErrors.assigneeId[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="motivo" className="block text-sm font-medium text-slate-700">
          Motivo <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <textarea
          id="motivo"
          name="motivo"
          rows={2}
          maxLength={500}
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          placeholder="Puedes dejar una nota de la asignación"
          className={textareaClass}
        />
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
        {pending
          ? "Guardando…"
          : currentAssignee
            ? "Reasignar"
            : "Asignar"}
      </button>

      <p className="text-xs text-slate-500">
        Al reasignar se cierra el fichaje abierto del trabajador saliente.
      </p>
    </form>
  );
}

function ResponsableActual({
  currentAssignee,
}: {
  currentAssignee: { name: string } | null;
}) {
  return (
    <p className="text-sm text-slate-600">
      Responsable actual:{" "}
      <span className="font-medium text-slate-900">
        {currentAssignee?.name ?? "Sin asignar"}
      </span>
    </p>
  );
}
