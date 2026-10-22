import Link from "next/link";

import { CpuIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/site/icons";
import { CONTACT, NAV_LINKS } from "@/lib/site-content";

const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-cyan-300">
                <CpuIcon className="size-5" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-slate-950">
                SoftHard A&amp;L
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600">
              Reparación de ordenadores, portátiles e impresoras y venta de productos
              informáticos. Diagnóstico claro y presupuesto antes de reparar.
            </p>
          </div>

          <nav aria-label="Secciones del sitio">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Secciones
            </h2>
            <ul className="mt-4 space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-600 transition-colors hover:text-slate-950"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/app"
                  className="text-sm text-slate-600 transition-colors hover:text-slate-950"
                >
                  Área de cliente
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Contacto
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>
                <a
                  href={CONTACT.phoneHref}
                  className="flex items-center gap-2 transition-colors hover:text-slate-950"
                >
                  <PhoneIcon className="size-4 shrink-0 text-slate-400" />
                  {CONTACT.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="flex items-center gap-2 transition-colors hover:text-slate-950"
                >
                  <MailIcon className="size-4 shrink-0 text-slate-400" />
                  {CONTACT.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-slate-400" />
                <span>{CONTACT.addressLines.join(", ")}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {YEAR} SoftHard A&amp;L. Todos los derechos reservados.</p>
          <p>Sitio de demostración con datos ficticios.</p>
        </div>
      </div>
    </footer>
  );
}
