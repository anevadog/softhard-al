import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no carga .env automáticamente: de ahí el import de dotenv.
// Se usa process.env en lugar del helper env() para que comandos que no
// necesitan BD (como `prisma generate`) funcionen sin DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
