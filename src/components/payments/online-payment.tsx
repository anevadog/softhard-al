import { formatEuros } from "@/lib/format";

/**
 * Botón "Pagar con tarjeta" (5.3): un formulario hacia la Server Action que
 * crea la sesión de pago y redirige a la pasarela. El importe que se muestra
 * es informativo; el que se cobra lo calcula el servidor.
 */
export function OnlinePaymentButton({
  accion,
  id,
  importe,
}: {
  accion: (formData: FormData) => Promise<void>;
  id: string;
  importe: number;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Pagar con tarjeta · {formatEuros(importe)}
      </button>
    </form>
  );
}

const AVISOS: Record<string, { texto: string; clase: string }> = {
  ok: {
    texto: "Pago completado. Ya tienes la factura disponible.",
    clase: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  error: {
    texto: "El pago no se ha completado. Puedes volver a intentarlo.",
    clase: "border-rose-200 bg-rose-50 text-rose-800",
  },
  abandonado: {
    texto: "Has salido de la pasarela sin pagar. Puedes volver a intentarlo.",
    clase: "border-slate-200 bg-slate-100 text-slate-700",
  },
  reembolsado: {
    texto: "El pago llegó cuando ya no se podía cobrar y lo hemos devuelto.",
    clase: "border-amber-200 bg-amber-50 text-amber-900",
  },
  "no-disponible": {
    texto: "Ahora mismo no se puede pagar online.",
    clase: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

/** Aviso al volver de la pasarela (`?pago=`). Valores desconocidos: nada. */
export function OnlinePaymentNotice({ pago }: { pago: string | undefined }) {
  const aviso = pago ? AVISOS[pago] : undefined;

  if (!aviso) {
    return null;
  }

  return (
    <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${aviso.clase}`}>
      {aviso.texto}
    </p>
  );
}
