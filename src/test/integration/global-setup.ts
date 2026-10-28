import { execSync } from "node:child_process";

import pg from "pg";

import { asegurarBdDeTest, derivarUrlDeTest } from "@/test/integration/test-database";

/**
 * Antes de los tests de integración: comprueba que la base `_test` existe (no
 * la crea: crear o borrar bases es una decisión manual) y le aplica las
 * migraciones con `prisma migrate deploy`.
 */
export default async function setup(): Promise<void> {
  // `test.env` solo llega a los workers, no al global setup: aquí se deriva
  // la URL de nuevo (es idempotente si ya termina en _test).
  const { url } = derivarUrlDeTest(process.env.DATABASE_URL);
  asegurarBdDeTest(url);

  const cliente = new pg.Client({ connectionString: url });

  try {
    await cliente.connect();
  } catch (error) {
    const codigo = (error as { code?: string }).code;
    const nombre = new URL(url).pathname.slice(1);

    if (codigo === "3D000") {
      throw new Error(
        `La base "${nombre}" no existe. Créala una vez con:\n` +
          `  docker compose exec db createdb -U postgres ${nombre}\n` +
          "o con createdb si usas un PostgreSQL local.",
      );
    }

    throw error;
  } finally {
    await cliente.end().catch(() => undefined);
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
