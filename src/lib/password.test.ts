import { beforeAll, describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  const PLAIN = "secreto123";
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(PLAIN);
  });

  it("genera un hash bcrypt con coste 12 y distinto del texto plano", () => {
    expect(passwordHash).not.toBe(PLAIN);
    expect(passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it("acepta la contraseña correcta", async () => {
    await expect(verifyPassword(PLAIN, passwordHash)).resolves.toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    await expect(verifyPassword("secreto124", passwordHash)).resolves.toBe(false);
  });

  it("genera hashes distintos para la misma contraseña (sal aleatoria)", async () => {
    const otroHash = await hashPassword(PLAIN);

    expect(otroHash).not.toBe(passwordHash);
    await expect(verifyPassword(PLAIN, otroHash)).resolves.toBe(true);
  });
});
