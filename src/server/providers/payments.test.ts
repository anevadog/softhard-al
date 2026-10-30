import { describe, expect, it } from "vitest";

import {
  MockPaymentProvider,
  nombreProveedorPago,
  obtenerPaymentProvider,
  proveedorMockActivo,
} from "@/server/providers/payments";

describe("selección del proveedor de pago", () => {
  it("por defecto es el mock", () => {
    expect(nombreProveedorPago({})).toBe("mock");
    expect(obtenerPaymentProvider({}).nombre).toBe("mock");
  });

  it("stripe está preparado pero no activo; un valor desconocido falla", () => {
    expect(() => obtenerPaymentProvider({ PAYMENT_PROVIDER: "stripe" })).toThrow("no está activada");
    expect(() => nombreProveedorPago({ PAYMENT_PROVIDER: "paypal" })).toThrow("desconocido");
  });

  it("la página mock solo existe con el proveedor mock", () => {
    expect(proveedorMockActivo({})).toBe(true);
    expect(proveedorMockActivo({ PAYMENT_PROVIDER: "mock" })).toBe(true);
    expect(proveedorMockActivo({ PAYMENT_PROVIDER: "stripe" })).toBe(false);
    expect(proveedorMockActivo({ PAYMENT_PROVIDER: "paypal" })).toBe(false);
  });
});

describe("MockPaymentProvider", () => {
  it("deriva el id de la referencia y paga en la página mock", async () => {
    const sesion = await new MockPaymentProvider().crearSesion({
      importeCentimos: 5_990,
      referencia: "ses-1",
      urlRetorno: "/app/pedidos/1",
    });

    expect(sesion).toEqual({ id: "mock_ses-1", urlPago: "/pago/mock/ses-1" });
  });

  it("rechaza importes no positivos o con fracción de céntimo", async () => {
    const proveedor = new MockPaymentProvider();

    for (const importeCentimos of [0, -100, 10.5]) {
      await expect(
        proveedor.crearSesion({ importeCentimos, referencia: "x", urlRetorno: "/" }),
      ).rejects.toThrow("Importe de pago no válido");
    }
  });

  it("registra los reembolsos", async () => {
    const proveedor = new MockPaymentProvider();
    await proveedor.reembolsar("mock_ses-1");

    expect(proveedor.reembolsos).toEqual(["mock_ses-1"]);
  });
});
