"use client";

import { useActionState } from "react";

import { FORM_STATE_INICIAL } from "@/lib/form-state";
import {
  SERVICE_STATUSES_PANEL,
  SERVICE_STATUS_META,
} from "@/lib/service-requests";
import { cambiarEstadoAction } from "@/server/actions/admin-requests";
import type { ServiceStatus } from "@/generated/prisma/enums";

const selectClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

export function StatusForm({
  requestId,
  status,
}: {
  requestId: string;
  status: ServiceStatus;
}) {
  const [state, formAction, pending] = useActionState(
    cambiarEstadoAction,
    FORM_STATE_INICIAL,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-slate-700">
          Estado actual: {SERVICE_STATUS_META[status].label}
        </label>
        <select id="status" name="status" defaultValue={status} className={selectClass}>
          {SERVICE_STATUSES_PANEL.map((valor) => (
            <option key={valor} value={valor}>
              {SERVICE_STATUS_META[valor].label}
            </option>
          ))}
        </select>
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
