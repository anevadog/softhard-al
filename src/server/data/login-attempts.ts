import { prisma } from "@/lib/db";
import {
  inicioVentana,
  limiteRetencion,
  type FallosRecientes,
} from "@/lib/login-rate-limit";

/** Fallos recientes por email y por IP dentro de la ventana del límite. */
export async function contarFallosRecientes(
  email: string,
  ip: string | null,
  ahora = new Date(),
): Promise<FallosRecientes> {
  const desde = inicioVentana(ahora);

  const [porEmail, porIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: desde } },
    }),
    ip
      ? prisma.loginAttempt.count({
          where: { ip, success: false, createdAt: { gte: desde } },
        })
      : Promise.resolve(null),
  ]);

  return { porEmail, porIp };
}

/**
 * Registra un intento y borra, en la misma transacción, los de más de 24 h:
 * limpieza perezosa sin cron, apoyada en el índice por `createdAt`.
 */
export async function registrarIntentoLogin(
  datos: { email: string; ip: string | null; success: boolean },
  ahora = new Date(),
): Promise<void> {
  await prisma.$transaction([
    prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: limiteRetencion(ahora) } },
    }),
    prisma.loginAttempt.create({
      data: { ...datos, createdAt: ahora },
    }),
  ]);
}
