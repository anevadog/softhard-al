import { describe, expect, it } from "vitest";

import {
  evaluarLimite,
  inicioVentana,
  ipDesdeCabeceras,
  limiteRetencion,
} from "@/lib/login-rate-limit";

const cabeceras = (valores: Record<string, string>) => new Headers(valores);

describe("evaluarLimite", () => {
  it("permite hasta 4 fallos por email y bloquea al quinto", () => {
    expect(evaluarLimite({ porEmail: 4, porIp: 0 })).toEqual({ bloqueado: false });
    expect(evaluarLimite({ porEmail: 5, porIp: 0 })).toEqual({ bloqueado: true, motivo: "email" });
  });

  it("bloquea por IP al llegar a 20 fallos aunque el email sea nuevo", () => {
    expect(evaluarLimite({ porEmail: 0, porIp: 19 })).toEqual({ bloqueado: false });
    expect(evaluarLimite({ porEmail: 0, porIp: 20 })).toEqual({ bloqueado: true, motivo: "ip" });
  });

  it("sin IP solo limita por email", () => {
    expect(evaluarLimite({ porEmail: 0, porIp: null })).toEqual({ bloqueado: false });
    expect(evaluarLimite({ porEmail: 5, porIp: null })).toEqual({ bloqueado: true, motivo: "email" });
  });
});

describe("ventanas", () => {
  const ahora = new Date("2026-10-28T12:00:00Z");

  it("la ventana de fallos es de 15 minutos", () => {
    expect(inicioVentana(ahora).toISOString()).toBe("2026-10-28T11:45:00.000Z");
  });

  it("los intentos se conservan 24 horas", () => {
    expect(limiteRetencion(ahora).toISOString()).toBe("2026-10-27T12:00:00.000Z");
  });
});

describe("ipDesdeCabeceras", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    expect(ipDesdeCabeceras(cabeceras({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
  });

  it("usa x-real-ip si no hay x-forwarded-for", () => {
    expect(ipDesdeCabeceras(cabeceras({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  it("devuelve null sin cabeceras o con valores vacíos", () => {
    expect(ipDesdeCabeceras(undefined)).toBeNull();
    expect(ipDesdeCabeceras(cabeceras({ "x-forwarded-for": " , " }))).toBeNull();
  });

  it("recorta valores anormalmente largos", () => {
    expect(ipDesdeCabeceras(cabeceras({ "x-real-ip": "a".repeat(200) }))?.length).toBe(64);
  });
});
