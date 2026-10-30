import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { formatEuros } from "@/lib/format";
import { confirmarPagoMockAction } from "@/server/actions/online-payments";
import { obtenerSesionMock } from "@/server/data/online-payments";
import { proveedorMockActivo } from "@/server/providers/payments";

export const metadata = {
  title: "Pasarela de pago (simulada)",
};

/**
 * Pasarela simulada (5.3). Solo existe con `PAYMENT_PROVIDER=mock` y solo para
 * el cliente dueño de la sesión; en cualquier otro caso, 404.
 */
export default async function PagoMockPage({ params }: { params: Promise<{ sesion: string }> }) {
  if (!proveedorMockActivo()) {
    notFound();
  }

  const { sesion: id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/pago/mock/${id}`)}`);
  }

  const sesion = await obtenerSesionMock(id, session.user.id);

  if (!sesion) {
    notFound();
  }

  const boton = "w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Pasarela simulada · no se cobra nada
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{sesion.concepto}</h1>
          <p className="mt-1 text-3xl font-semibold text-slate-950">
            {formatEuros(sesion.importeCentimos / 100)}
          </p>
          <p className="mt-1 text-xs text-slate-500">IVA incluido</p>
        </div>

        {sesion.status === "pendiente" ? (
          <form action={confirmarPagoMockAction} className="space-y-3">
            <input type="hidden" name="sesion" value={sesion.id} />
            <button
              type="submit"
              name="resultado"
              value="pagado"
              className={`${boton} bg-slate-950 text-white hover:bg-slate-800`}
            >
              Pagar
            </button>
            <button
              type="submit"
              name="resultado"
              value="fallido"
              className={`${boton} border border-rose-300 text-rose-700 hover:bg-rose-50`}
            >
              Simular error
            </button>
            <button
              type="submit"
              name="resultado"
              value="abandonado"
              className={`${boton} border border-slate-300 text-slate-700 hover:bg-slate-100`}
            >
              Abandonar
            </button>
          </form>
        ) : (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Este intento de pago ya no está abierto.</p>
            <Link href={sesion.returnPath} className="font-medium text-slate-900 underline">
              Volver
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
