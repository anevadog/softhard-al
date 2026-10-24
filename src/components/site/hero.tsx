import Link from "next/link";

import { ArrowRightIcon, BoxIcon, CheckIcon } from "@/components/site/icons";
import { TRUST_POINTS } from "@/lib/site-content";

const TIMELINE = [
  { label: "Equipo recibido", state: "done" },
  { label: "Diagnóstico realizado", state: "done" },
  { label: "En reparación", state: "current" },
  { label: "Listo para entregar", state: "pending" },
] as const;

const REQUEST = [
  { label: "Equipo", value: "Portátil Lenovo" },
  { label: "Avería", value: "No arranca tras actualizar" },
  { label: "Modalidad", value: "Recogida a domicilio" },
];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* Fondo decorativo: degradado + rejilla técnica. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(65%_55%_at_50%_0%,#ecfeff_0%,#ffffff_70%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:72px_72px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">
            <span className="size-1.5 rounded-full bg-cyan-500" aria-hidden="true" />
            Servicio técnico · Madrid
          </p>

          <h1
            id="hero-title"
            className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.4rem]"
          >
            Tu ordenador, portátil o impresora,{" "}
            <span className="bg-linear-to-r from-cyan-600 to-sky-600 bg-clip-text text-transparent">
              en buenas manos
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
            Somos un taller especializado en reparación de equipos informáticos y venta de
            productos. Diagnóstico claro, presupuesto antes de tocar nada y recogida a domicilio
            o en taller.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            >
              Registrarse
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="/productos"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            >
              <BoxIcon className="size-4" />
              Ver productos
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <CheckIcon className="size-4 shrink-0 text-cyan-600" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Panel de muestra: comunica el flujo sin depender de imágenes. */}
        <div className="relative mx-auto w-full max-w-md">
          <div
            aria-hidden="true"
            className="absolute -inset-3 -z-10 rounded-3xl bg-linear-to-br from-cyan-100 via-sky-50 to-white blur-2xl"
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Solicitud
                </p>
                <p className="mt-1 font-mono text-sm font-medium text-slate-900">#1042</p>
              </div>
              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 ring-1 ring-cyan-100">
                En reparación
              </span>
            </div>

            <dl className="mt-5 space-y-2.5 text-sm">
              {REQUEST.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="text-right font-medium text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>

            <ol className="relative mt-6 space-y-3 border-t border-slate-100 pt-5">
              <span
                aria-hidden="true"
                className="absolute bottom-2.5 left-[7px] top-7 w-px bg-slate-200"
              />
              {TIMELINE.map((item) => (
                <li key={item.label} className="relative flex items-center gap-3 text-sm">
                  <span
                    className={
                      item.state === "done"
                        ? "z-10 flex size-4 items-center justify-center rounded-full bg-cyan-600 text-white"
                        : item.state === "current"
                          ? "z-10 flex size-4 items-center justify-center rounded-full border-2 border-cyan-600 bg-white"
                          : "z-10 flex size-4 items-center justify-center rounded-full border border-slate-300 bg-white"
                    }
                  >
                    {item.state === "done" ? <CheckIcon className="size-2.5" /> : null}
                    {item.state === "current" ? (
                      <span className="size-1.5 rounded-full bg-cyan-600" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span
                    className={
                      item.state === "pending" ? "text-slate-500" : "font-medium text-slate-800"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-5 rounded-lg bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
              El importe del diagnóstico se descuenta del presupuesto si aceptas la reparación.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
