import { prisma } from "@/lib/db";

/** Perfil fiscal del propio usuario: solo el NIF. */
export async function obtenerPerfil(
  userId: string,
): Promise<{ name: string; email: string; nif: string | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, nif: true },
  });
}

/**
 * Cambia solo el NIF del usuario de la sesión. Las facturas ya emitidas no
 * cambian: guardan una copia de los datos del cliente.
 */
export async function actualizarNif(userId: string, nif: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { nif } });
}
