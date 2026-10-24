import Link from "next/link";

import { CpuIcon } from "@/components/site/icons";
import { MobileNav } from "@/components/site/mobile-nav";
import { NAV_LINKS } from "@/lib/site-content";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-600"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-cyan-300">
            <CpuIcon className="size-5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-slate-950">
              SoftHard A&amp;L
            </span>
            <span className="mt-1 hidden text-[11px] text-slate-500 sm:block">
              Servicio técnico
            </span>
          </span>
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-7 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-slate-600 transition-colors hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 sm:text-sm"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-slate-950 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-slate-800 sm:px-3.5 sm:text-sm"
          >
            Registrarse
          </Link>
        </div>

        <MobileNav />
      </div>
    </header>
  );
}
