import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { autorizarCredenciales } from "@/lib/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      // Validación, límite de intentos y comprobación de contraseña.
      authorize: (rawCredentials, request) => autorizarCredenciales(rawCredentials, request),
    }),
  ],
});
