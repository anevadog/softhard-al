import { describe, expect, it } from "vitest";

import {
  anioFiscal,
  codigoFactura,
  conAjuste,
  desglosarFactura,
  facturaVigente,
  lineasDiagnostico,
  lineasPedido,
  lineasRectificativa,
  lineasReparacion,
  modalidadFactura,
  puedeReemitir,
  type FacturaDeEntidad,
} from "@/lib/invoices";

describe("código y año de la factura", () => {
  it("formatea serie, año y número con cuatro dígitos", () => {
    expect(codigoFactura("FAC", 2026, 7)).toBe("FAC-2026-0007");
    expect(codigoFactura("MIG", 2025, 12345)).toBe("MIG-2025-12345");
  });

  it("el año se calcula en Europe/Madrid", () => {
    expect(anioFiscal(new Date("2026-12-31T22:30:00Z"))).toBe(2026);
    expect(anioFiscal(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
  });

  it("con NIF la factura es completa; sin él, simplificada", () => {
    expect(modalidadFactura("12345678Z")).toBe("completa");
    expect(modalidadFactura(null)).toBe("simplificada");
  });
});

describe("líneas de la factura", () => {
  it("un pedido tiene una línea por producto", () => {
    expect(
      lineasPedido([{ productName: "Teclado", quantity: 2, priceCentimos: 4990 }]),
    ).toEqual([{ description: "Teclado", quantity: 2, unitPriceCentimos: 4990 }]);
  });

  it("una reparación descuenta el diagnóstico y suma el importe final", () => {
    const lineas = lineasReparacion({
      equipo: "portátil",
      brand: "Lenovo",
      model: "T14",
      budgetCentimos: 12000,
      diagnosticFeeCentimos: 3000,
    });

    expect(lineas).toEqual([
      { description: "Reparación de portátil Lenovo T14", quantity: 1, unitPriceCentimos: 12000 },
      { description: "Descuento diagnóstico", quantity: 1, unitPriceCentimos: -3000 },
    ]);
    expect(desglosarFactura(lineas, 21).totales.totalCentimos).toBe(9000);
  });

  it("el ajuste hace que el total sea lo cobrado, en ambos sentidos", () => {
    const base = lineasDiagnostico(3000);

    expect(conAjuste(base, 3000)).toEqual(base);
    expect(conAjuste(base, 2500).at(-1)).toEqual({
      description: "Ajuste de importe",
      quantity: 1,
      unitPriceCentimos: -500,
    });
    expect(desglosarFactura(conAjuste(base, 3200), 21).totales.totalCentimos).toBe(3200);
  });

  it("la rectificativa niega cada línea y su desglose es el opuesto exacto", () => {
    const original = conAjuste(
      lineasPedido([{ productName: "Tóner", quantity: 3, priceCentimos: 7990 }]),
      23000,
    );
    const a = desglosarFactura(original, 21);
    const r = desglosarFactura(lineasRectificativa(original), 21);

    expect(r.totales).toEqual({
      totalCentimos: -a.totales.totalCentimos,
      baseCentimos: -a.totales.baseCentimos,
      ivaCentimos: -a.totales.ivaCentimos,
    });
  });

  it("en cada línea y en el total, base + IVA = total", () => {
    const { lineas, totales } = desglosarFactura(
      lineasReparacion({
        equipo: "impresora",
        brand: "HP",
        model: "X",
        budgetCentimos: 9999,
        diagnosticFeeCentimos: 3001,
      }),
      21,
    );

    for (const linea of [...lineas, totales]) {
      expect(linea.baseCentimos + linea.ivaCentimos).toBe(linea.totalCentimos);
    }
  });
});

describe("factura vigente y re-emisión", () => {
  const ordinaria = (id: string): FacturaDeEntidad => ({
    id,
    kind: "ordinaria",
    rectifiesInvoiceId: null,
  });
  const rect = (id: string, de: string): FacturaDeEntidad => ({
    id,
    kind: "rectificativa",
    rectifiesInvoiceId: de,
  });

  it("la vigente es la ordinaria que nadie ha rectificado", () => {
    expect(facturaVigente([ordinaria("a")])?.id).toBe("a");
    expect(facturaVigente([ordinaria("a"), rect("r", "a")])).toBeNull();
    expect(facturaVigente([ordinaria("a"), rect("r", "a"), ordinaria("b")])?.id).toBe("b");
    expect(facturaVigente([])).toBeNull();
  });

  it("se re-emite solo con cobro, original rectificada sin sustituta y entidad activa", () => {
    const rectificada = [ordinaria("a"), rect("r", "a")];

    expect(puedeReemitir({ pagada: true, status: "lista", facturas: rectificada })).toBe(true);
    expect(puedeReemitir({ pagada: true, status: "entregada", facturas: rectificada })).toBe(true);
    expect(puedeReemitir({ pagada: true, status: "pagado", facturas: rectificada })).toBe(true);
    expect(puedeReemitir({ pagada: false, status: "lista", facturas: rectificada })).toBe(false);
    expect(puedeReemitir({ pagada: true, status: "lista", facturas: [ordinaria("a")] })).toBe(false);
    expect(puedeReemitir({ pagada: true, status: "lista", facturas: [] })).toBe(false);

    for (const status of ["cancelado", "rechazada", "expirada"] as const) {
      expect(puedeReemitir({ pagada: true, status, facturas: rectificada })).toBe(false);
    }
  });
});
