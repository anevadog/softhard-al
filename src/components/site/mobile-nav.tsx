"use client";

import type { MouseEvent } from "react";
import Link from "next/link";

import { MenuIcon } from "@/components/site/icons";
import { NAV_LINKS } from "@/lib/site-content";

export function MobileNav() {
  function cerrarMenu(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  return (
    <details className="group relative md:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-center rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <MenuIcon className="size-5" />
        <span className="sr-only">Abrir menú</span>
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
        <nav aria-label="Navegación móvil">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={cerrarMenu}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <Link
            href="/login"
            onClick={cerrarMenu}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            onClick={cerrarMenu}
            className="mt-1 block rounded-lg bg-slate-950 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Registrarse
          </Link>
        </div>
      </div>
    </details>
  );
}
