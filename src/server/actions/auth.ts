"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CODIGO_DEMASIADOS_INTENTOS } from "@/lib/login-rate-limit";
import { destinoTrasLogin, rutaInternaSegura } from "@/lib/navigation";
import { hashPassword } from "@/lib/password";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import type { AuthFormState } from "@/server/actions/auth-state";

const MENSAJE_CREDENCIALES = "Email o contraseña incorrectos.";
const MENSAJE_DEMASIADOS_INTENTOS =
  "Demasiados intentos fallidos. Espera unos minutos antes de volver a probar.";

function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function registerUser(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      status: "error",
      message: "Revisa los datos del formulario.",
      fieldErrors,
    };
  }

  const { name, email, password } = parsed.data;

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        // El rol nunca se acepta desde el formulario: el registro público
        // solo puede crear clientes.
        role: "cliente",
      },
    });
  } catch (error) {
    if (esViolacionDeUnicidad(error)) {
      return {
        status: "error",
        message: "Ya existe una cuenta con ese email.",
        fieldErrors: { email: ["Ya existe una cuenta con ese email."] },
      };
    }

    console.error("Error creando usuario:", error);
    return {
      status: "error",
      message: "No se pudo crear la cuenta. Inténtalo más tarde.",
    };
  }

  const callbackUrl = rutaInternaSegura(formData.get("callbackUrl"));
  const params = new URLSearchParams({ registrado: "1" });

  if (callbackUrl) {
    params.set("callbackUrl", callbackUrl);
  }

  redirect(`/login?${params.toString()}`);
}

export async function loginUser(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: MENSAJE_CREDENCIALES };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // El límite de intentos llega como CredentialsSignin con su propio código.
      const limitado =
        (error as { code?: unknown }).code === CODIGO_DEMASIADOS_INTENTOS;

      return {
        status: "error",
        message: limitado ? MENSAJE_DEMASIADOS_INTENTOS : MENSAJE_CREDENCIALES,
      };
    }
    throw error;
  }

  // Tras signIn no se puede leer la sesión nueva en la misma petición (la
  // cookie aún no está en la request), así que el destino sale del rol en BD.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { role: true },
  });

  redirect(destinoTrasLogin(formData.get("callbackUrl"), user?.role));
}
