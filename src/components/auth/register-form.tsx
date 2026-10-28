"use client";

import { useState, useTransition, type FormEvent } from "react";

import { registerUser } from "@/server/actions/auth";
import { AUTH_FORM_STATE_INICIAL, type AuthFormState } from "@/server/actions/auth-state";

type Campo = "name" | "email" | "password" | "confirmPassword";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return <p className="text-xs text-red-600">{messages[0]}</p>;
}

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, setState] = useState<AuthFormState>(AUTH_FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const [valores, setValores] = useState<Record<Campo, string>>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const fieldErrors = state.fieldErrors ?? {};

  function cambiar(campo: Campo, valor: string) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }));
  }

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve; ante un error se
      // conserva lo escrito para corregir solo el campo marcado.
      const resultado = await registerUser(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-4" noValidate>
      {callbackUrl ? (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      ) : null}

      {state.status === "error" && state.message ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={valores.name}
          onChange={(event) => cambiar("name", event.target.value)}
          className={inputClass}
        />
        <FieldError messages={fieldErrors.name} />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={valores.email}
          onChange={(event) => cambiar("email", event.target.value)}
          className={inputClass}
        />
        <FieldError messages={fieldErrors.email} />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={valores.password}
          onChange={(event) => cambiar("password", event.target.value)}
          className={inputClass}
        />
        <FieldError messages={fieldErrors.password} />
        <p className="text-xs text-slate-500">Mínimo 8 caracteres.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
          Repite la contraseña
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={valores.confirmPassword}
          onChange={(event) => cambiar("confirmPassword", event.target.value)}
          className={inputClass}
        />
        <FieldError messages={fieldErrors.confirmPassword} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
