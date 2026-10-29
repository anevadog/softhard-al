import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Worker de emails (5.2): `npm run worker:emails`. Recorre la cola
 * `pending_emails` cada pocos segundos y envía por el `EmailProvider` activo
 * (`EMAIL_PROVIDER`). Se puede arrancar más de uno: `FOR UPDATE SKIP LOCKED`
 * evita que dos tomen la misma fila. Ctrl+C lo detiene al terminar el lote.
 */

const INTERVALO_MS = 5_000;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// La capa de datos toma el cliente de globalThis al importarse.
(globalThis as unknown as { prisma?: PrismaClient }).prisma = prisma;

let parar = false;
process.on("SIGINT", () => {
  parar = true;
});
process.on("SIGTERM", () => {
  parar = true;
});

async function main() {
  const { procesarEmailsPendientes } = await import("../src/server/data/emails");
  const { obtenerEmailProvider } = await import("../src/server/providers/email");
  const provider = obtenerEmailProvider();

  console.log(`Worker de emails con el proveedor "${provider.nombre}" (cada ${INTERVALO_MS / 1000} s).`);

  while (!parar) {
    try {
      const resultado = await procesarEmailsPendientes({ provider });

      if (resultado.enviados + resultado.reintentos + resultado.fallidos > 0) {
        console.log(
          `${new Date().toISOString()} enviados=${resultado.enviados} ` +
            `reintentos=${resultado.reintentos} fallidos=${resultado.fallidos}`,
        );
      }
    } catch (error) {
      console.error("Error en el lote de emails:", error);
    }

    await new Promise((resolver) => setTimeout(resolver, INTERVALO_MS));
  }

  console.log("Worker de emails detenido.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
