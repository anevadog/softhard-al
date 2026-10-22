import type { ComponentType } from "react";

import {
  BoxIcon,
  CheckIcon,
  LaptopIcon,
  MonitorIcon,
  PrinterIcon,
  type IconProps,
} from "@/components/site/icons";
import { SectionHeading } from "@/components/site/section-heading";
import { SERVICES, type ServiceIcon } from "@/lib/site-content";

const ICONS: Record<ServiceIcon, ComponentType<IconProps>> = {
  monitor: MonitorIcon,
  laptop: LaptopIcon,
  printer: PrinterIcon,
  box: BoxIcon,
};

export function ServicesSection() {
  return (
    <section
      id="servicios"
      aria-labelledby="servicios-title"
      className="scroll-mt-24 border-t border-slate-100 bg-white py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="servicios-title"
          eyebrow="Servicios"
          title="Lo que reparamos y vendemos"
          description="Servicio técnico para particulares y pequeños negocios: desde un portátil que no arranca hasta la puesta a punto de la impresora de la oficina."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => {
            const Icon = ICONS[service.icon];

            return (
              <article
                key={service.id}
                className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-cyan-200 hover:bg-slate-50/60"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-cyan-300">
                  <Icon className="size-5" />
                </span>

                <h3 className="mt-4 text-base font-semibold text-slate-950">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {service.description}
                </p>

                <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm text-slate-600">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-cyan-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
