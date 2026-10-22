import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { contarSolicitudesCliente } from "@/server/data/service-requests";

export const metadata = {
  title: "Mi área",
};

export default async function AppHomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/app");
  }

  const total = await contarSolicitudesCliente(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Hola, {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Desde aquí puedes solicitar un servicio técnico y seguir el estado de tus reparaciones.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Tus solicitudes</h2>
        <p className="mt-1 text-sm text-slate-600">
          {total === 0
            ? "Todavía no has creado ninguna solicitud."
            : total === 1
              ? "Tienes 1 solicitud registrada."
              : `Tienes ${total} solicitudes registradas.`}
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/app/solicitudes/nueva"
            className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Nueva solicitud
          </Link>
          <Link
            href="/app/solicitudes"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Ver todas
          </Link>
        </div>
      </div>
    </div>
  );
}
