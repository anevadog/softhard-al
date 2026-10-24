import { describe, expect, it } from "vitest";

import { destinoTrasLogin, rutaInternaSegura } from "@/lib/navigation";

describe("callback de navegación", () => {
  it("acepta rutas internas con búsqueda y hash", () => {
    expect(rutaInternaSegura("/carrito")).toBe("/carrito");
    expect(rutaInternaSegura("/app/pedidos/abc?creado=1#detalle")).toBe(
      "/app/pedidos/abc?creado=1#detalle",
    );
  });

  it("rechaza destinos externos o protocolos peligrosos", () => {
    expect(rutaInternaSegura("https://evil.example")).toBeNull();
    expect(rutaInternaSegura("//evil.example")).toBeNull();
    expect(rutaInternaSegura("/\\evil.example")).toBeNull();
    expect(rutaInternaSegura("javascript:alert(1)")).toBeNull();
  });

  it("rechaza las propias pantallas de autenticación y valores raros", () => {
    expect(rutaInternaSegura("/login")).toBeNull();
    expect(rutaInternaSegura("/register")).toBeNull();
    expect(rutaInternaSegura("/carrito\nLocation: https://evil.example")).toBeNull();
    expect(rutaInternaSegura(null)).toBeNull();
    expect(rutaInternaSegura(["/carrito"])).toBeNull();
  });

  it("devuelve al callback interno si el rol puede acceder", () => {
    expect(destinoTrasLogin("/carrito", "cliente")).toBe("/carrito");
    expect(destinoTrasLogin("/app/pedidos/abc", "trabajador")).toBe(
      "/app/pedidos/abc",
    );
    expect(destinoTrasLogin("/admin/solicitudes", "encargado")).toBe(
      "/admin/solicitudes",
    );
  });

  it("no permite que un cliente vuelva al panel", () => {
    expect(destinoTrasLogin("/admin", "cliente")).toBe("/app");
    expect(destinoTrasLogin("/admin/productos", "trabajador")).toBe("/app");
  });

  it("usa el destino por defecto del rol si el callback no es válido", () => {
    expect(destinoTrasLogin("https://evil.example", "cliente")).toBe("/app");
    expect(destinoTrasLogin(null, "encargado")).toBe("/admin");
    expect(destinoTrasLogin(null, "cliente")).toBe("/app");
    expect(destinoTrasLogin(null, null)).toBe("/app");
  });
});
