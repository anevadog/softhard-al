"use client";

import Link from "next/link";
import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { LaptopIcon, MonitorIcon, PrinterIcon } from "@/components/site/icons";
import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import { crearSolicitudAction } from "@/server/actions/service-requests";

const EQUIPOS = [
  { value: "ordenador", label: "Ordenador", Icon: MonitorIcon },
  { value: "portatil", label: "Portátil", Icon: LaptopIcon },
  { value: "impresora", label: "Impresora", Icon: PrinterIcon },
] as const;

const MODALIDADES = [
  { value: "domicilio", label: "Recogida a domicilio", hint: "Pasamos a por el equipo" },
  { value: "taller", label: "Entrega en taller", hint: "Lo llevas tú mismo" },
] as const;

const FRANJAS = [
  { value: "manana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
  { value: "indiferente", label: "Indiferente" },
] as const;

type Campo = "equipmentType" | "brand" | "model" | "issue" | "modality" | "timeSlot";

const labelClass = "block text-sm font-medium text-slate-700";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

const opcionClass =
  "flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700 transition-colors hover:border-slate-400 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50/60 has-[:checked]:text-slate-950 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-900 has-[:focus-visible]:ring-offset-2";

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;

  return (
    <p id={id} className="mt-1.5 text-xs text-red-600">
      {messages[0]}
    </p>
  );
}

export function ServiceRequestForm() {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  // Campos controlados: al enviar sin `action` de React se evita el reinicio
  // automático del formulario, así no se pierde lo escrito si falla la
  // validación.
  const [valores, setValores] = useState<Record<Campo, string>>({
    equipmentType: "",
    brand: "",
    model: "",
    issue: "",
    modality: "",
    timeSlot: "indiferente",
  });

  function alCambiar(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setValores((previos) => ({ ...previos, [name as Campo]: value }));
  }

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // Si la acción tiene éxito redirige y esta promesa no vuelve.
      const resultado = await crearSolicitudAction(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-6" noValidate>
      {state.status === "error" && state.message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <fieldset>
        <legend className={labelClass}>Tipo de equipo</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {EQUIPOS.map(({ value, label, Icon }) => (
            <label key={value} className={opcionClass}>
              <input
                type="radio"
                name="equipmentType"
                value={value}
                checked={valores.equipmentType === value}
                onChange={alCambiar}
                className="sr-only"
              />
              <Icon className="size-4 text-slate-500" />
              <span className="font-medium">{label}</span>
            </label>
          ))}
        </div>
        <FieldError id="equipmentType-error" messages={errors.equipmentType} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="brand" className={labelClass}>
            Marca
          </label>
          <input
            id="brand"
            name="brand"
            type="text"
            placeholder="Lenovo, HP, Epson…"
            autoComplete="off"
            maxLength={60}
            value={valores.brand}
            onChange={alCambiar}
            aria-invalid={Boolean(errors.brand)}
            aria-describedby={errors.brand ? "brand-error" : undefined}
            className={inputClass}
          />
          <FieldError id="brand-error" messages={errors.brand} />
        </div>

        <div>
          <label htmlFor="model" className={labelClass}>
            Modelo
          </label>
          <input
            id="model"
            name="model"
            type="text"
            placeholder="ThinkPad T14, LaserJet…"
            autoComplete="off"
            maxLength={60}
            value={valores.model}
            onChange={alCambiar}
            aria-invalid={Boolean(errors.model)}
            aria-describedby={errors.model ? "model-error" : undefined}
            className={inputClass}
          />
          <FieldError id="model-error" messages={errors.model} />
        </div>
      </div>

      <div>
        <label htmlFor="issue" className={labelClass}>
          ¿Qué le pasa al equipo?
        </label>
        <textarea
          id="issue"
          name="issue"
          rows={5}
          maxLength={2000}
          placeholder="Cuéntanos el problema con el mayor detalle posible: cuándo empezó, qué mensajes aparecen, si hace ruidos…"
          value={valores.issue}
          onChange={alCambiar}
          aria-invalid={Boolean(errors.issue)}
          aria-describedby={errors.issue ? "issue-error" : "issue-hint"}
          className={inputClass}
        />
        {errors.issue ? (
          <FieldError id="issue-error" messages={errors.issue} />
        ) : (
          <p id="issue-hint" className="mt-1.5 text-xs text-slate-500">
            Mínimo 10 caracteres. Cuanta más información, mejor diagnóstico.
          </p>
        )}
      </div>

      <fieldset>
        <legend className={labelClass}>¿Cómo nos haces llegar el equipo?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {MODALIDADES.map(({ value, label, hint }) => (
            <label key={value} className={`${opcionClass} items-start`}>
              <input
                type="radio"
                name="modality"
                value={value}
                checked={valores.modality === value}
                onChange={alCambiar}
                className="sr-only"
              />
              <span className="flex flex-col">
                <span className="font-medium">{label}</span>
                <span className="mt-0.5 text-xs text-slate-500">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="modality-error" messages={errors.modality} />
      </fieldset>

      <div className="sm:max-w-xs">
        <label htmlFor="timeSlot" className={labelClass}>
          Franja horaria preferida
        </label>
        <select
          id="timeSlot"
          name="timeSlot"
          value={valores.timeSlot}
          onChange={alCambiar}
          aria-invalid={Boolean(errors.timeSlot)}
          aria-describedby={errors.timeSlot ? "timeSlot-error" : undefined}
          className={inputClass}
        >
          {FRANJAS.map((franja) => (
            <option key={franja.value} value={franja.value}>
              {franja.label}
            </option>
          ))}
        </select>
        <FieldError id="timeSlot-error" messages={errors.timeSlot} />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Crear solicitud"}
        </button>
        <Link
          href="/app/solicitudes"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
