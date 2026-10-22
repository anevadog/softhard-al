import type { ComponentType } from "react";

import { MapPinIcon, ShieldIcon, type IconProps } from "@/components/site/icons";
import { SectionHeading } from "@/components/site/section-heading";
import { HIGHLIGHTS, STEPS, type Feature } from "@/lib/site-content";

const ICONS: Record<Feature["icon"], ComponentType<IconProps>> = {
  shield: ShieldIcon,
  "map-pin": MapPinIcon,
};

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="scroll-mt-24 border-y border-slate-200 bg-slate-50 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="como-funciona-title"
          eyebrow="Cómo funciona"
          title="Cuatro pasos, sin sorpresas"
          description="Desde que nos cuentas la avería hasta que recoges el equipo: siempre sabes en qué punto está tu reparación y cuánto va a costar."
        />

        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-6">
              <span className="inline-flex rounded-md bg-cyan-50 px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-cyan-700 ring-1 ring-cyan-100">
                PASO {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-base font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {HIGHLIGHTS.map((highlight) => {
            const Icon = ICONS[highlight.icon];

            return (
              <div
                key={highlight.title}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-6"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-cyan-300">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{highlight.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {highlight.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
