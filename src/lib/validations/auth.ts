import { z } from "zod";

// bcrypt trunca silenciosamente a 72 bytes: lo cortamos en validación.
const MAX_PASSWORD_BYTES = 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email no válido")
  .max(254, "El email es demasiado largo");

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .refine(
    (value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES,
    `La contraseña no puede superar los ${MAX_PASSWORD_BYTES} bytes`,
  );

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(80, "El nombre es demasiado largo"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
