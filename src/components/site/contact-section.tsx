import Link from "next/link";

import {
  CheckIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "@/components/site/icons";
import { SectionHeading } from "@/components/site/section-heading";
import { CONTACT } from "@/lib/site-content";

const CTA_POINTS = [
  "Crea tu cuenta en menos de un minuto",
  "Describe el equipo y elige domicilio o taller",
  "Sigue el estado y el presupuesto desde tu área",
];

export function ContactSection() {
  return (
    <section
      id="contacto"
      aria-labelledby="contacto-title"
      className="scroll-mt-24 bg-white py-20 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <SectionHeading
            id="contacto-title"
            align="left"
            eyebrow="Contacto"
            title="Hablemos de tu equipo"
            description="Escríbenos o llámanos si tienes dudas antes de registrar la solicitud. También puedes pasarte por el taller."
          />

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-5">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <PhoneIcon className="size-4 text-slate-400" />
                Teléfono
              </dt>
              <dd className="mt-2 text-sm">
                <a
                  href={CONTACT.phoneHref}
                  className="font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  {CONTACT.phone}
                </a>
              </dd>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <MailIcon className="size-4 text-slate-400" />
                Email
              </dt>
              <dd className="mt-2 text-sm">
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="font-medium text-slate-900 underline-offset-4 hover:underline"
                >
                  {CONTACT.email}
                </a>
              </dd>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <MapPinIcon className="size-4 text-slate-400" />
                Taller
              </dt>
              <dd className="mt-2 text-sm text-slate-900">
                {CONTACT.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </dd>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <ClockIcon className="size-4 text-slate-400" />
                Horario
              </dt>
              <dd className="mt-2 text-sm text-slate-900">
                {CONTACT.hours.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>

        <div className="relative isolate overflow-hidden rounded-2xl bg-slate-950 p-7 text-white sm:p-9">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-12 -z-10 size-48 rounded-full bg-cyan-500/25 blur-3xl"
          />

          <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
            ¿Empezamos con tu reparación?
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Registra el equipo en un par de minutos. Te confirmamos el diagnóstico y el presupuesto
            antes de hacer nada.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
            {CTA_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-white/25 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Iniciar sesión
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Las solicitudes se gestionan desde el área de cliente.
          </p>
        </div>
      </div>
    </section>
  );
}
