import { describe, expect, it } from "vitest";

import { puedeAcceder } from "@/lib/authz";

describe("puedeAcceder", () => {
  it("bloquea sin sesión", () => {
    expect(puedeAcceder("/app", null)).toBe(false);
    expect(puedeAcceder("/admin", undefined)).toBe(false);
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

  it("no confunde rutas que solo empiezan igual", () => {
    expect(puedeAcceder("/administracion", "cliente")).toBe(true);
  });
});
