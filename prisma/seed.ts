import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcrypt";

import { PrismaClient } from "../src/generated/prisma/client";
import { evaluarSeed } from "../src/lib/seed-guard";

const guardSeed = evaluarSeed();

if (!guardSeed.permitido) {
  if (guardSeed.motivo === "url-ausente") {
    console.error("Seed bloqueado: DATABASE_URL no está definida.");
  } else if (guardSeed.motivo === "url-invalida") {
    console.error("Seed bloqueado: DATABASE_URL no se puede interpretar.");
  } else {
    console.error(
      `Seed bloqueado: el host "${guardSeed.host}" no es local. ` +
        "Usa SEED_ALLOW_PRODUCTION=true solo si confirmas que quieres cargar los datos demo en esa base.",
    );
  }

  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

// La capa de datos (facturas del histórico) toma el cliente de globalThis al
// importarse: se registra este antes de importarla, para no abrir otro pool.
(globalThis as unknown as { prisma?: PrismaClient }).prisma = prisma;

async function main() {
  const { DEMO_PASSWORD, sembrarConfig, sembrarProductos, sembrarUsuarios } = await import(
    "../src/server/seed/demo"
  );
  const { sembrarHistorico } = await import("../src/server/seed/historico");

  // Fuera de la transacción: bcrypt con coste 12 tarda.
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  // Todo en una transacción: o se carga el seed completo o nada.
  await prisma.$transaction(
    async (tx) => {
      const config = await sembrarConfig(tx);
      console.log(
        `Config lista: tarifa de diagnóstico = ${config.diagnosticFee} €, expiración = ${config.expirationDays} días, ` +
          `aviso sin actividad = ${config.inactiveRequestHours} h, fichaje abierto = ${config.openWorkLogHours} h`,
      );

      const usuarios = await sembrarUsuarios(tx, passwordHash);
      console.log(`Usuarios demo: ${usuarios} cuentas con contraseña "${DEMO_PASSWORD}"`);

      const productos = await sembrarProductos(tx);
      console.log(`Productos demo: ${productos} creados en esta ejecución`);

      const historico = await sembrarHistorico(tx, new Date());
      console.log(
        `Histórico demo: ${historico.reparaciones} reparaciones, ${historico.pedidos} pedidos ` +
          `y ${historico.facturas} facturas creadas en esta ejecución`,
      );
    },
    { timeout: 120_000 },
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
