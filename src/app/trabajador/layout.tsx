import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "@/lib/auth";
import { requerirPersonalTaller } from "@/server/authorization";

export default async function TallerLayout({ children }: { children: ReactNode }) {
  const usuario = await requerirPersonalTaller();
  const esStaff = usuario.role !== "trabajador";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/trabajador" className="text-sm font-semibold text-slate-900">
              Taller SoftHard A&amp;L
            </Link>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {usuario.role}
            </span>
          </div>

          <nav aria-label="Área de taller" className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/app" className="text-slate-600 transition-colors hover:text-slate-900">
              Mi área
            </Link>
            {esStaff ? (
              <Link
                href="/admin"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Panel
              </Link>
            ) : (
              <Link
                href="/trabajador/fichajes"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Mis fichajes
              </Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
