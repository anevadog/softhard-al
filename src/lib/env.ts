import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL no está definida"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET debe tener al menos 32 caracteres"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
});

if (!parsed.success) {
  throw new Error(
    `Variables de entorno inválidas: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
  );
}

export const env = parsed.data;
