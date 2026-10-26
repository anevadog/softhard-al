import { describe, expect, it } from "vitest";

import { esPersonalTaller, puedeAcceder } from "@/lib/authz";

describe("esPersonalTaller", () => {
  it("incluye a trabajadores, encargados y admin", () => {
    expect(esPersonalTaller("trabajador")).toBe(true);
    expect(esPersonalTaller("encargado")).toBe(true);
    expect(esPersonalTaller("admin")).toBe(true);
  });

  it("excluye a clientes y usuarios sin rol", () => {
    expect(esPersonalTaller("cliente")).toBe(false);
    expect(esPersonalTaller(null)).toBe(false);
  });
});

describe("puedeAcceder", () => {
  it("bloquea sin sesión", () => {
    expect(puedeAcceder("/app", null)).toBe(false);
    expect(puedeAcceder("/admin", undefined)).toBe(false);
    expect(puedeAcceder("/trabajador", null)).toBe(false);
  });

  it("permite /app a cualquier usuario autenticado", () => {
    expect(puedeAcceder("/app", "cliente")).toBe(true);
    expect(puedeAcceder("/app", "trabajador")).toBe(true);
    expect(puedeAcceder("/app", "encargado")).toBe(true);
    expect(puedeAcceder("/app", "admin")).toBe(true);
  });

  it("bloquea /admin a cliente y trabajador", () => {
    expect(puedeAcceder("/admin", "cliente")).toBe(false);
    expect(puedeAcceder("/admin", "trabajador")).toBe(false);
  });

  it("permite /admin a encargado y admin", () => {
    expect(puedeAcceder("/admin", "encargado")).toBe(true);
    expect(puedeAcceder("/admin", "admin")).toBe(true);
  });

  it("aplica la regla a subrutas de /admin", () => {
    expect(puedeAcceder("/admin/solicitudes", "cliente")).toBe(false);
    expect(puedeAcceder("/admin/solicitudes", "encargado")).toBe(true);
  });

  it("bloquea /trabajador a clientes", () => {
    expect(puedeAcceder("/trabajador", "cliente")).toBe(false);
    expect(puedeAcceder("/trabajador/reparaciones", "cliente")).toBe(false);
  });

  it("permite /trabajador al personal de taller", () => {
    expect(puedeAcceder("/trabajador", "trabajador")).toBe(true);
    expect(puedeAcceder("/trabajador/reparaciones", "trabajador")).toBe(true);
    expect(puedeAcceder("/trabajador", "encargado")).toBe(true);
    expect(puedeAcceder("/trabajador", "admin")).toBe(true);
  });

  it("no confunde rutas que solo empiezan igual", () => {
    expect(puedeAcceder("/administracion", "cliente")).toBe(true);
    expect(puedeAcceder("/trabajadores", "cliente")).toBe(true);
  });
});
