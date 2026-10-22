import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Crear cuenta",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Crear cuenta</h1>
        <p className="mt-1 mb-5 text-sm text-slate-600">
          Regístrate para solicitar un servicio técnico.
        </p>

        <RegisterForm />

        <p className="mt-5 text-center text-sm text-slate-600">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
