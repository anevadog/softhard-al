import { redirect } from "next/navigation";

import { NifForm } from "@/components/invoices/nif-form";
import { auth } from "@/lib/auth";
import { obtenerPerfil } from "@/server/data/profile";

export const metadata = {
  title: "Perfil",
};

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ nif?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/app/perfil");
  }

  const [perfil, { nif }] = await Promise.all([obtenerPerfil(session.user.id), searchParams]);

  if (!perfil) {
    redirect("/login?callbackUrl=/app/perfil");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Perfil</h1>
        <p className="mt-1 text-sm text-slate-600">
          {perfil.name} · {perfil.email}
        </p>
      </div>

      {nif === "guardado" || nif === "eliminado" ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {nif === "guardado"
            ? "NIF guardado. Tus próximas facturas serán completas."
            : "NIF eliminado. Tus próximas facturas serán simplificadas."}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Datos fiscales</h2>
        <div className="mt-4 max-w-sm">
          <NifForm nifActual={perfil.nif} />
        </div>
      </section>
    </div>
  );
}
