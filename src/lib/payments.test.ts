import { describe, expect, it } from "vitest";

import {
  cobroEsperadoPedido,
  cobroEsperadoSolicitud,
  etiquetaMetodoPago,
  exigeCobroParaEntregar,
  importesIguales,
  validarImporteCobro,
  type DatosCobroPedido,
  type DatosCobroSolicitud,
} from "@/lib/payments";

const AHORA = new Date("2026-10-28T12:00:00Z");

function pedido(cambios: Partial<DatosCobroPedido> = {}): DatosCobroPedido {
  return {
    status: "pendiente",
    total: 59.9,
    expiresAt: new Date("2026-10-29T12:00:00Z"),
    paidAt: null,
    ...cambios,
  };
}

function solicitud(cambios: Partial<DatosCobroSolicitud> = {}): DatosCobroSolicitud {
  return {
    status: "lista",
    paidAt: null,
    quote: { status: "aceptado", finalAmount: 90, diagnosticFee: 30 },
    ...cambios,
  };
}

describe("cobro esperado de un pedido", () => {
  it("un pendiente vigente se cobra por su total", () => {
    expect(cobroEsperadoPedido(pedido(), AHORA)).toBe(59.9);
    expect(cobroEsperadoPedido(pedido({ expiresAt: null }), AHORA)).toBe(59.9);
  });

  it("no se cobra un vencido, uno ya cobrado ni uno que no está pendiente", () => {
    expect(cobroEsperadoPedido(pedido({ expiresAt: AHORA }), AHORA)).toBeNull();
    expect(cobroEsperadoPedido(pedido({ paidAt: AHORA }), AHORA)).toBeNull();

    for (const status of ["pagado", "entregado", "cancelado", "caducado"] as const) {
      expect(cobroEsperadoPedido(pedido({ status }), AHORA)).toBeNull();
    }
  });
});

describe("cobro esperado de una solicitud", () => {
  it("en lista con presupuesto aceptado se cobra el importe final", () => {
    expect(cobroEsperadoSolicitud(solicitud())).toEqual({
      concepto: "reparacion",
      importe: 90,
    });
  });

  it("en rechazada o expirada se cobra el diagnóstico", () => {
    for (const status of ["rechazada", "expirada"] as const) {
      expect(
        cobroEsperadoSolicitud(
          solicitud({
            status,
            quote: {
              status: status === "rechazada" ? "rechazado" : "expirado",
              finalAmount: status === "rechazada" ? 30 : null,
              diagnosticFee: 30,
            },
          }),
        ),
      ).toEqual({ concepto: "diagnostico", importe: 30 });
    }
  });

  it("un importe de 0 € no es un cobro", () => {
    expect(
      cobroEsperadoSolicitud(
        solicitud({ quote: { status: "aceptado", finalAmount: 0, diagnosticFee: 30 } }),
      ),
    ).toBeNull();
    expect(
      cobroEsperadoSolicitud(
        solicitud({
          status: "rechazada",
          quote: { status: "rechazado", finalAmount: 0, diagnosticFee: 0 },
        }),
      ),
    ).toBeNull();
  });

  it("no hay cobro sin presupuesto, si ya está cobrada o en estados intermedios", () => {
    expect(cobroEsperadoSolicitud(solicitud({ quote: null }))).toBeNull();
    expect(cobroEsperadoSolicitud(solicitud({ paidAt: AHORA }))).toBeNull();

    for (const status of ["pendiente", "aceptada", "en_reparacion", "entregada"] as const) {
      expect(cobroEsperadoSolicitud(solicitud({ status }))).toBeNull();
    }
  });
});

describe("cobro para entregar", () => {
  it("solo se exige con presupuesto aceptado e importe final > 0", () => {
    expect(
      exigeCobroParaEntregar({ status: "aceptado", finalAmount: 90, diagnosticFee: 30 }),
    ).toBe(true);
    expect(
      exigeCobroParaEntregar({ status: "aceptado", finalAmount: 0, diagnosticFee: 30 }),
    ).toBe(false);
    expect(
      exigeCobroParaEntregar({ status: "rechazado", finalAmount: 30, diagnosticFee: 30 }),
    ).toBe(false);
    expect(exigeCobroParaEntregar(null)).toBe(false);
  });
});

describe("importe del cobro", () => {
  it("compara importes al céntimo", () => {
    expect(importesIguales(0.1 + 0.2, 0.3)).toBe(true);
    expect(importesIguales(59.9, 59.91)).toBe(false);
  });

  it("el importe esperado vale para cualquier staff, sin nota", () => {
    expect(
      validarImporteCobro({ esperado: 90, importe: 90, nota: null, esAdmin: false }),
    ).toEqual({ ok: true });
  });

  it("solo admin cobra otro importe y con motivo", () => {
    expect(
      validarImporteCobro({ esperado: 90, importe: 80, nota: "Descuento", esAdmin: false }),
    ).toEqual({ ok: false, motivo: "importe-no-permitido" });
    expect(
      validarImporteCobro({ esperado: 90, importe: 80, nota: "  ok ", esAdmin: true }),
    ).toEqual({ ok: false, motivo: "motivo-obligatorio" });
    expect(
      validarImporteCobro({
        esperado: 90,
        importe: 80,
        nota: "Descuento por retraso",
        esAdmin: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe("etiquetas de método", () => {
  it("traduce los métodos y marca los cobros migrados sin método", () => {
    expect(etiquetaMetodoPago("bizum")).toBe("Bizum");
    expect(etiquetaMetodoPago("tarjeta_online")).toBe("Tarjeta (pago online)");
    expect(etiquetaMetodoPago(null)).toBe("No consta");
  });
});
