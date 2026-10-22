import type { NextAuthConfig } from "next-auth";

import type { Role } from "@/generated/prisma/enums";

/**
 * Configuración compartida entre el runtime de Next y el middleware (Edge).
 * REGLA: este archivo no puede importar Prisma, bcrypt ni nada que dependa
 * de Node, o el middleware deja de compilar.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        if (token.role) {
          session.user.role = token.role;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export type SessionRole = Role;
