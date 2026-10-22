import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validations/auth";

const VALID_REGISTER = {
  name: "Ana Pérez",
  email: "ana@example.com",
  password: "contrasena-larga",
  confirmPassword: "contrasena-larga",
};

describe("loginSchema", () => {
  it("normaliza el email quitando espacios y pasándolo a minúsculas", () => {
    const result = loginSchema.parse({ email: "  ANA@Example.COM ", password: "x" });

    expect(result.email).toBe("ana@example.com");
  });

  it("rechaza un email inválido", () => {
    expect(loginSchema.safeParse({ email: "no-es-email", password: "x" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("acepta un registro válido y normaliza el email", () => {
    const result = registerSchema.parse({ ...VALID_REGISTER, email: " Ana@Example.COM " });

    expect(result.email).toBe("ana@example.com");
  });

  it("exige contraseña de al menos 8 caracteres", () => {
    const result = registerSchema.safeParse({
      ...VALID_REGISTER,
      password: "corta",
      confirmPassword: "corta",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza contraseñas de más de 72 bytes (límite de bcrypt)", () => {
    // "á" ocupa 2 bytes en UTF-8: 40 caracteres = 80 bytes.
    const password = "á".repeat(40);
    const result = registerSchema.safeParse({ ...VALID_REGISTER, password, confirmPassword: password });

    expect(result.success).toBe(false);
  });

  it("exige que las contraseñas coincidan", () => {
    const result = registerSchema.safeParse({
      ...VALID_REGISTER,
      confirmPassword: "otra-distinta",
    });

    expect(result.success).toBe(false);
  });

  it("descarta campos desconocidos como role", () => {
    const result = registerSchema.parse({ ...VALID_REGISTER, role: "admin" });

    expect(result).not.toHaveProperty("role");
  });

  it("rechaza un nombre demasiado corto", () => {
    expect(registerSchema.safeParse({ ...VALID_REGISTER, name: "A" }).success).toBe(false);
  });
});
