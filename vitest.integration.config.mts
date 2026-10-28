import "dotenv/config";

import { defineConfig } from "vitest/config";

import { derivarUrlDeTest } from "./src/test/integration/test-database";

/**
 * Tests de integración contra PostgreSQL real (`npm run test:integration`).
 * Usan una base aparte, `<base>_test`, derivada de DATABASE_URL; cada test va
 * dentro de una transacción que se revierte. `npm run test` no los ejecuta.
 */
const { url } = derivarUrlDeTest(process.env.DATABASE_URL);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/test/integration/global-setup.ts"],
    setupFiles: ["src/test/integration/setup.ts"],
    env: {
      DATABASE_URL: url,
      // La capa de datos valida AUTH_SECRET al importarse; los tests no firman JWT.
      AUTH_SECRET: process.env.AUTH_SECRET ?? "secreto-solo-para-tests-de-integracion-0000",
    },
    // Una sola conexión y en serie: las transacciones no compiten por filas.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
