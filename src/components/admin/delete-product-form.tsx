"use client";

import { useState, useTransition, type FormEvent } from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { borrarProductoAction } from "@/server/actions/products";

export function DeleteProductForm({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !window.confirm(
        `¿Borrar "${productName}"? Dejará de aparecer en el catálogo, pero conservará su historial.`,
      )
    ) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await borrarProductoAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />

      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-5 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-60"
      >
        {pending ? "Borrando…" : "Borrar producto"}
      </button>
    </form>
  );
}
