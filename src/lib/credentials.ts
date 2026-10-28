import { CredentialsSignin } from "next-auth";

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  CODIGO_DEMASIADOS_INTENTOS,
  evaluarLimite,
  ipDesdeCabeceras,
} from "@/lib/login-rate-limit";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations/auth";
import { contarFallosRecientes, registrarIntentoLogin } from "@/server/data/login-attempts";

/**
 * Hash de relleno (coste 12) para que un email inexistente tarde lo mismo que
 * uno existente con contraseña incorrecta. Evita enumerar cuentas por tiempo.
 */
const DUMMY_HASH = "$2b$12$8leBXpN9CS6km.l2c3LmFefk090mCcmLX3m/x3uYdyeUQbeDkEItS";

export class DemasiadosIntentos extends CredentialsSignin {
  code = CODIGO_DEMASIADOS_INTENTOS;
}

export type UsuarioAutenticado = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/**
 * `authorize` de Credentials. Va aquí y no en la acción porque el endpoint de
 * Auth.js también es público: el límite debe aplicarse en cualquier vía de
 * login. Con el límite superado se rechaza aunque la contraseña sea correcta.
 */
export async function autorizarCredenciales(
  rawCredentials: unknown,
  request?: Pick<Request, "headers">,
): Promise<UsuarioAutenticado | null> {
  const parsed = loginSchema.safeParse(rawCredentials);
  if (!parsed.success) return null;

  const { email, password } = parsed.data;
  const ip = ipDesdeCabeceras(request?.headers);

  const limite = evaluarLimite(await contarFallosRecientes(email, ip));
  if (limite.bloqueado) {
    throw new DemasiadosIntentos();
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  const success = Boolean(user && passwordOk);

  await registrarIntentoLogin({ email, ip, success });

  if (!user || !success) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
