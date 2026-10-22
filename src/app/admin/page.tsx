import { prisma } from "@/lib/db";

export const metadata = {
  title: "Solicitudes",
};

export default async function AdminHomePage() {
  const total = await prisma.serviceRequest.count();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Solicitudes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vista global de solicitudes entrantes. El listado y el cambio de estado llegan en una
          tarea posterior.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">
          Solicitudes registradas: <span className="font-semibold text-slate-900">{total}</span>
        </p>
      </div>
    </div>
  );
}
