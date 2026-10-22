import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth, signOut } from "@/lib/auth";
import { esStaff } from "@/lib/authz";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/app");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-5">
            <Link href="/app" className="text-sm font-semibold text-slate-900">
              SoftHard A&amp;L
            </Link>

            <nav aria-label="Área de cliente" className="flex items-center gap-4 text-sm">
              <Link
                href="/app"
                className="hidden text-slate-600 transition-colors hover:text-slate-900 sm:inline"
              >
                Mi área
              </Link>
              <Link
                href="/app/solicitudes"
                className="text-slate-600 transition-colors hover:text-slate-900"
              >
                Solicitudes
              </Link>
              {esStaff(session.user.role) ? (
                <Link
                  href="/admin"
                  className="hidden text-slate-600 transition-colors hover:text-slate-900 sm:inline"
                >
                  Panel
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 lg:inline">{session.user.email}</span>

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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
