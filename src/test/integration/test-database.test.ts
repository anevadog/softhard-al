import { describe, expect, it } from "vitest";

import { asegurarBdDeTest, derivarUrlDeTest } from "@/test/integration/test-database";

describe("derivarUrlDeTest", () => {
  it("añade el sufijo _test conservando servidor, credenciales y parámetros", () => {
    expect(
      derivarUrlDeTest("postgresql://postgres:postgres@localhost:5432/softhard?schema=public"),
    ).toEqual({
      url: "postgresql://postgres:postgres@localhost:5432/softhard_test?schema=public",
      nombre: "softhard_test",
    });
  });

  it("no duplica el sufijo si ya lo tiene", () => {
    expect(derivarUrlDeTest("postgresql://u:p@127.0.0.1:5432/softhard_test").nombre).toBe(
      "softhard_test",
    );
  });

  it("rechaza hosts remotos, URLs inválidas o sin base", () => {
    expect(() => derivarUrlDeTest("postgresql://u:p@db.ejemplo.com:5432/softhard")).toThrow(
      "no es local",
    );
    expect(() => derivarUrlDeTest("no-es-una-url")).toThrow("no es una URL válida");
    expect(() => derivarUrlDeTest("postgresql://u:p@localhost:5432/")).toThrow(
      "no indica la base",
    );
    expect(() => derivarUrlDeTest(undefined)).toThrow("falta DATABASE_URL");
  });
});

describe("asegurarBdDeTest", () => {
  it("solo permite bases locales con sufijo _test", () => {
    expect(() => asegurarBdDeTest("postgresql://u:p@localhost:5432/softhard_test")).not.toThrow();
    expect(() => asegurarBdDeTest("postgresql://u:p@localhost:5432/softhard")).toThrow();
    expect(() => asegurarBdDeTest("postgresql://u:p@remoto.com:5432/softhard_test")).toThrow();
    expect(() => asegurarBdDeTest(undefined)).toThrow();
  });
});
