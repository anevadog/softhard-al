import { requerirPersonalTaller } from "@/server/authorization";

export const metadata = {
  title: "Taller",
};

export default async function TallerHomePage() {
  const usuario = await requerirPersonalTaller();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Hola, {usuario.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Este es el acceso al área de taller. Desde aquí podrás consultar tus
          reparaciones, fichar y dejar notas internas.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Área en preparación</h2>
        <p className="mt-2 text-sm text-slate-600">
          Los datos y permisos del taller ya están listados. Las reparaciones,
          el fichaje y las notas se incorporarán en las siguientes sub-fases.
        </p>
      </section>
    </div>
  );
}
