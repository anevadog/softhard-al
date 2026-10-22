import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

/**
 * Configuración de negocio por defecto (fila única con id = 1).
 * Idempotente: si la fila ya existe no se sobrescribe, para no pisar
 * valores ajustados a mano en local.
 */
async function main() {
  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      diagnosticFee: 30,
      expirationDays: 7,
    },
  });

  console.log(
    `Config lista: tarifa de diagnóstico = ${config.diagnosticFee} €, expiración = ${config.expirationDays} días`,
  );
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
