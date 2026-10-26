import type { Prisma } from "@/generated/prisma/client";

/**
 * Cierra los fichajes abiertos de una reparación dentro de una transacción.
 * No se limita a un destino concreto: cualquier estado nuevo distinto de
 * `en_reparacion` deja la reparación fuera de la mesa de trabajo.
 */
export async function cerrarFichajesAbiertosEnTx(
  tx: Prisma.TransactionClient,
  datos: {
    requestId: string;
    userId?: string | null;
    endedAt?: Date;
  },
): Promise<number> {
  const resultado = await tx.workLog.updateMany({
    where: {
      requestId: datos.requestId,
      endedAt: null,
      ...(datos.userId ? { userId: datos.userId } : {}),
    },
    data: { endedAt: datos.endedAt ?? new Date() },
  });

  return resultado.count;
}
