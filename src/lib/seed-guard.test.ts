import { describe, expect, it } from "vitest";

import { esHostLocal, evaluarSeed } from "@/lib/seed-guard";

const URL_LOCAL = "postgresql://postgres:postgres@localhost:5432/softhard";

describe("protección del seed", () => {
  it("reconoce los hosts locales permitidos", () => {
    expect(esHostLocal("localhost")).toBe(true);
    expect(esHostLocal("127.0.0.1")).toBe(true);
    expect(esHostLocal("::1")).toBe(true);
    expect(esHostLocal("[::1]")).toBe(true);
    expect(esHostLocal("db")).toBe(true);
    expect(esHostLocal("LOCALHOST.")).toBe(true);
    expect(esHostLocal("neon.tech")).toBe(false);
    expect(esHostLocal("localhost.evil.com")).toBe(false);
  });

  it("permite un host local aunque NODE_ENV sea development", () => {
    expect(
      evaluarSeed({
        DATABASE_URL: URL_LOCAL,
        NODE_ENV: "development",
      }),
    ).toEqual({ permitido: true, host: "localhost" });
  });

  it("bloquea un host remoto aunque NODE_ENV sea development", () => {
    const resultado = evaluarSeed({
      DATABASE_URL: "postgresql://usuario:secreto@ep-123.neon.tech/softhard",
      NODE_ENV: "development",
    });

    expect(resultado).toEqual({
      permitido: false,
      motivo: "host-no-local",
      host: "ep-123.neon.tech",
    });
  });

  it("permite un host remoto con activación explícita", () => {
    expect(
      evaluarSeed({
        DATABASE_URL: "postgresql://usuario:secreto@ep-123.neon.tech/softhard",
        SEED_ALLOW_PRODUCTION: "true",
      }),
    ).toEqual({ permitido: true, host: "ep-123.neon.tech" });
  });

  it("rechaza una URL ausente", () => {
    expect(evaluarSeed({})).toEqual({
      permitido: false,
      motivo: "url-ausente",
    });
    expect(evaluarSeed({ DATABASE_URL: "   " })).toEqual({
      permitido: false,
      motivo: "url-ausente",
    });
  });

  it("rechaza una URL inválida o sin host", () => {
    expect(evaluarSeed({ DATABASE_URL: "no-es-una-url" })).toEqual({
      permitido: false,
      motivo: "url-invalida",
    });
    expect(evaluarSeed({ DATABASE_URL: "postgresql:///softhard" })).toEqual({
      permitido: false,
      motivo: "url-invalida",
    });
  });

  it("la activación explícita no permite una URL inválida o ausente", () => {
    expect(
      evaluarSeed({
        SEED_ALLOW_PRODUCTION: "true",
      }),
    ).toEqual({ permitido: false, motivo: "url-ausente" });

    expect(
      evaluarSeed({
        DATABASE_URL: "no-es-una-url",
        SEED_ALLOW_PRODUCTION: "true",
      }),
    ).toEqual({ permitido: false, motivo: "url-invalida" });
  });
});
