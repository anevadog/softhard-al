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
          <Link href="/" className="text-sm font-semibold text-slate-900">
            SoftHard A&amp;L
          </Link>

          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-600 sm:inline">{session.user.email}</span>

            {esStaff(session.user.role) ? (
              <Link href="/admin" className="font-medium text-slate-900 underline">
                Panel
              </Link>
            ) : null}

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

      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
