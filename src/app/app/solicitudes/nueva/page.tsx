import Link from "next/link";

import { ServiceRequestForm } from "@/components/service-requests/service-request-form";

export const metadata = {
  title: "Nueva solicitud",
};

export default function NuevaSolicitudPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/app/solicitudes"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver a mis solicitudes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Nueva solicitud
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Cuéntanos qué equipo tienes y qué le pasa. Te confirmamos el diagnóstico antes de
          reparar nada.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <ServiceRequestForm />
      </div>
    </div>
  );
}
