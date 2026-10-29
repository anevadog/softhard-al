import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth, signOut } from "@/lib/auth";
import { esStaff } from "@/lib/authz";
import { prisma } from "@/lib/db";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  // El JWT puede llevar un rol obsoleto (cambios en BD no invalidan el token):
  // el panel revalida el rol contra la base de datos en cada carga.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || !esStaff(user.role)) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/admin" className="text-sm font-semibold text-slate-900">
              Panel interno
            </Link>

            <nav
              aria-label="Panel interno"
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
            >
              <Link
                href="/admin/solicitudes"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Solicitudes
              </Link>
              <Link
                href="/admin/dashboard"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/reportes"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Reportes
              </Link>
              <Link
                href="/admin/fichajes"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Fichajes
              </Link>
              <Link
                href="/admin/pedidos"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Pedidos
              </Link>
              <Link
                href="/admin/facturas"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Facturas
              </Link>
              <Link
                href="/admin/productos"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Productos
              </Link>
              <Link
                href="/admin/emails"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Emails
              </Link>
              <Link
                href="/trabajador"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Taller
              </Link>
            </nav>

            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {user.role}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/app" className="text-slate-600 hover:text-slate-900">
              Mi área
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
