import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Iniciar sesión",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registrado?: string }>;
}) {
  const { registrado } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Iniciar sesión</h1>
        <p className="mt-1 mb-5 text-sm text-slate-600">Accede a tu área de cliente.</p>

        {registrado === "1" ? (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Cuenta creada. Ya puedes iniciar sesión.
          </p>
        ) : null}

        <LoginForm />

        <p className="mt-5 text-center text-sm text-slate-600">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-slate-900 underline">
            Regístrate
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/" className="text-slate-500 hover:text-slate-900">
            Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
