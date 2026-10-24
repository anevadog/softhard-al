"use client";

import { useState } from "react";

export function AddToCartButton({
  agotado,
  nombre,
}: {
  agotado: boolean;
  nombre: string;
}) {
  const [avisoVisible, setAvisoVisible] = useState(false);

  if (agotado) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${nombre} agotado`}
        className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500"
      >
        Agotado
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setAvisoVisible(true)}
        aria-label={`Añadir ${nombre} al carrito`}
        className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
      >
        Añadir al carrito
      </button>
      {avisoVisible ? (
        <p role="status" className="mt-2 text-xs leading-relaxed text-slate-500">
          El carrito estará disponible en la próxima tarea.
        </p>
      ) : null}
    </div>
  );
}
