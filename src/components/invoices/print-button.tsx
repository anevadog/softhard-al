"use client";

/** Imprimir o guardar como PDF con el diálogo del navegador. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 print:hidden"
    >
      Imprimir o guardar PDF
    </button>
  );
}
