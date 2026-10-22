import { compare } from "bcrypt";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Hash de relleno (coste 12) para que un email inexistente tarde lo mismo que
 * uno existente con contraseña incorrecta. Evita enumerar cuentas por tiempo.
 */
const DUMMY_HASH = "$2b$12$8leBXpN9CS6km.l2c3LmFefk090mCcmLX3m/x3uYdyeUQbeDkEItS";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        const passwordHash = user?.passwordHash ?? DUMMY_HASH;
        const passwordOk = await compare(password, passwordHash);

        if (!user || !passwordOk) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
