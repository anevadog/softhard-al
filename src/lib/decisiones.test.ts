import { describe, expect, it } from "vitest";

import {
  estaExpirado,
  puedeDecidir,
  resolverDecision,
} from "@/lib/quotes";

const AHORA = new Date(2026, 9, 22, 10, 0, 0);

describe("estaExpirado", () => {
  it("no considera vencido un presupuesto que caduca más tarde", () => {
    expect(estaExpirado(new Date(2026, 9, 29, 10, 0, 0), AHORA)).toBe(false);
  });

  it("considera vencido un presupuesto que caduca en el mismo instante", () => {
    expect(estaExpirado(new Date(AHORA.getTime()), AHORA)).toBe(true);
  });

  it("considera vencido un presupuesto que caducó ayer", () => {
    expect(estaExpirado(new Date(2026, 9, 21, 10, 0, 0), AHORA)).toBe(true);
  });
});

describe("puedeDecidir", () => {
  const vigente = new Date(2026, 9, 29, 10, 0, 0);
  const vencido = new Date(2026, 9, 21, 10, 0, 0);

  it("permite decidir con presupuesto pendiente y solicitud diagnosticada", () => {
    expect(puedeDecidir("diagnosticada", "pendiente", vigente, AHORA)).toBe(true);
  });

  it("permite decidir si el encargado devolvió la solicitud a pendiente", () => {
    expect(puedeDecidir("pendiente", "pendiente", vigente, AHORA)).toBe(true);
  });

  it("bloquea la decisión si el presupuesto venció", () => {
    expect(puedeDecidir("diagnosticada", "pendiente", vencido, AHORA)).toBe(false);
  });

  it("bloquea la decisión si el presupuesto ya está aceptado", () => {
    expect(puedeDecidir("diagnosticada", "aceptado", vigente, AHORA)).toBe(false);
  });

  it("bloquea la decisión si el presupuesto ya está rechazado", () => {
    expect(puedeDecidir("diagnosticada", "rechazado", vigente, AHORA)).toBe(false);
  });

  it("bloquea la decisión si el presupuesto ya está expirado", () => {
    expect(puedeDecidir("diagnosticada", "expirado", vigente, AHORA)).toBe(false);
  });

  it("bloquea la decisión si el taller ya empezó la reparación", () => {
    expect(puedeDecidir("en_reparacion", "pendiente", vigente, AHORA)).toBe(false);
  });

  it("bloquea la decisión si la solicitud ya está entregada", () => {
    expect(puedeDecidir("entregada", "pendiente", vigente, AHORA)).toBe(false);
  });
});

describe("resolverDecision", () => {
  it("aceptar deja la solicitud y el presupuesto aceptados con el importe descontado", () => {
    expect(resolverDecision("aceptar", 120.5, 30)).toEqual({
      estadoSolicitud: "aceptada",
      estadoPresupuesto: "aceptado",
      importeFinal: 90.5,
    });
  });

  it("rechazar deja la solicitud y el presupuesto rechazados y solo cobra el diagnóstico", () => {
    expect(resolverDecision("rechazar", 120.5, 30)).toEqual({
      estadoSolicitud: "rechazada",
      estadoPresupuesto: "rechazado",
      importeFinal: 30,
    });
  });

  it("rechazar ignora el importe del presupuesto", () => {
    expect(resolverDecision("rechazar", 50, 30).importeFinal).toBe(30);
  });

  it("mantiene la aritmética de céntimos al aceptar", () => {
    expect(resolverDecision("aceptar", 0.3, 0.1).importeFinal).toBe(0.2);
  });
});
