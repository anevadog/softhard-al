import Link from "next/link";
import { redirect } from "next/navigation";

import { RequestCard } from "@/components/service-requests/request-card";
import { auth } from "@/lib/auth";
import { listarSolicitudesCliente } from "@/server/data/service-requests";

export const metadata = {
  title: "Mis solicitudes",
};

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/app/solicitudes");
  }

  const { creada } = await searchParams;
  const solicitudes = await listarSolicitudesCliente(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mis solicitudes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Consulta el estado de tus reparaciones.
          </p>
        </div>

        <Link
          href="/app/solicitudes/nueva"
          className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Nueva solicitud
        </Link>
      </div>

      {creada === "1" ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          Solicitud creada. Te avisaremos cuando cambie su estado.
        </p>
      ) : null}

      {solicitudes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-600">Todavía no has creado ninguna solicitud.</p>
          <Link
            href="/app/solicitudes/nueva"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Crear mi primera solicitud
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((solicitud) => (
            <li key={solicitud.id}>
              <RequestCard solicitud={solicitud} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
