"use client";

import { useState, useTransition, type FormEvent } from "react";

import type { OrderStatus } from "@/generated/prisma/enums";
import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import {
  ORDER_STATUSES,
  ORDER_STATUS_META,
  puedeCambiarEstadoPedido,
} from "@/lib/orders";
import { cambiarEstadoPedidoAction } from "@/server/actions/admin-orders";

const buttonBase =
  "inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60";

export function OrderStatusForm({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState("");

  const siguientes = ORDER_STATUSES.filter((estado) =>
    puedeCambiarEstadoPedido(status, estado),
  );

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await cambiarEstadoPedidoAction(state, formData);

      setState(resultado);
    });
  }

  if (siguientes.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        El pedido está {ORDER_STATUS_META[status].label.toLowerCase()} y ya no
        admite más cambios.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {state.status === "error" && state.message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      {siguientes
        .filter((estado) => estado !== "cancelado")
        .map((estado) => (
          <form key={estado} onSubmit={alEnviar}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="estadoEsperado" value={status} />
            <input type="hidden" name="estadoNuevo" value={estado} />
            <button
              type="submit"
              disabled={pending}
              className={`${buttonBase} bg-slate-950 text-white hover:bg-slate-800`}
            >
              {pending
                ? "Cambiando…"
                : `Marcar como ${ORDER_STATUS_META[estado].label.toLowerCase()}`}
            </button>
          </form>
        ))}

      {siguientes.includes("cancelado") ? (
        <form
          onSubmit={alEnviar}
          className="space-y-3 border-t border-slate-100 pt-4"
          noValidate
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="estadoEsperado" value={status} />
          <input type="hidden" name="estadoNuevo" value="cancelado" />

          {status === "pagado" ? (
            <>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Esta aplicación no gestiona reembolsos. Al cancelar solo se
                cambia el estado y se repone el stock.
              </p>

              <div>
                <label
                  htmlFor="motivo"
                  className="block text-sm font-medium text-slate-700"
                >
                  Motivo de la cancelación
                </label>
                <textarea
                  id="motivo"
                  name="motivo"
                  rows={3}
                  required
                  maxLength={500}
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Explica por qué se cancela el pedido"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  aria-invalid={Boolean(state.fieldErrors?.motivo)}
                />
                {state.fieldErrors?.motivo?.[0] ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.motivo[0]}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className={`${buttonBase} border border-rose-300 text-rose-700 hover:bg-rose-50`}
          >
            {pending ? "Cancelando…" : "Cancelar pedido"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
