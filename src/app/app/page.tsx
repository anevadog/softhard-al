import { auth } from "@/lib/auth";

export const metadata = {
  title: "Mi área",
};

export default async function AppHomePage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Hola, {session?.user?.name ?? "cliente"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Desde aquí podrás solicitar un servicio técnico y seguir el estado de tus solicitudes.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
        <h2 className="text-base font-medium text-slate-900">Tus solicitudes</h2>
        <p className="mt-1 text-sm text-slate-600">
          Todavía no hay ninguna solicitud. El formulario de solicitud llega en la siguiente tarea.
        </p>
      </div>
    </div>
  );
}
