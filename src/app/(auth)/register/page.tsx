import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";
import { rutaInternaSegura } from "@/lib/navigation";

export const metadata = {
  title: "Crear cuenta",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl: callbackUrlRaw } = await searchParams;
  const callbackUrl = rutaInternaSegura(callbackUrlRaw) ?? undefined;
  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Crear cuenta</h1>
        <p className="mt-1 mb-5 text-sm text-slate-600">
          Regístrate para solicitar un servicio técnico.
        </p>

        <RegisterForm callbackUrl={callbackUrl} />

        <p className="mt-5 text-center text-sm text-slate-600">
          ¿Ya tienes cuenta?{" "}
          <Link href={loginHref} className="font-medium text-slate-900 underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
