import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcrypt";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

/** Contraseña única para todas las cuentas de demostración (solo datos ficticios). */
const DEMO_PASSWORD = "Demo1234!";

const DEMO_USERS = [
  { email: "cliente@demo.local", name: "Cliente Demo", role: "cliente" as const },
  { email: "trabajador@demo.local", name: "Trabajador Demo", role: "trabajador" as const },
  { email: "encargado@demo.local", name: "Encargado Demo", role: "encargado" as const },
  { email: "admin@demo.local", name: "Admin Demo", role: "admin" as const },
];

/**
 * Configuración de negocio por defecto (fila única con id = 1).
 * Idempotente: si la fila ya existe no se sobrescribe, para no pisar
 * valores ajustados a mano en local.
 */
async function seedConfig() {
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

/** Cuentas de demo para probar los roles sin UI de administración. */
async function seedDemoUsers() {
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
  }

  console.log(`Usuarios demo: ${DEMO_USERS.length} cuentas con contraseña "${DEMO_PASSWORD}"`);
}

async function main() {
  await seedConfig();
  await seedDemoUsers();
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
