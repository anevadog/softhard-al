import { describe, expect, it } from "vitest";

import {
  entero,
  fecha,
  formatearImporteCsv,
  generarCsv,
  importe,
  serializarCelda,
  texto,
} from "@/lib/csv";

describe("generarCsv", () => {
  it("empieza con BOM, separa con ; y termina las líneas en CRLF", () => {
    const csv = generarCsv(["Cliente", "Total (IVA incl.)"], [[texto("Lucía Martín"), importe(12_345)]]);

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe("Cliente;Total (IVA incl.)\r\nLucía Martín;123,45\r\n");
  });

  it("sin filas solo lleva la cabecera", () => {
    expect(generarCsv(["A", "B"], [])).toBe("﻿A;B\r\n");
  });
});

describe("serializarCelda: texto", () => {
  it("entrecomilla según RFC 4180 si hay ;, comillas o saltos de línea", () => {
    expect(serializarCelda(texto('Teclado "pro"; negro'))).toBe('"Teclado ""pro""; negro"');
    expect(serializarCelda(texto("línea 1\nlínea 2"))).toBe('"línea 1\nlínea 2"');
    expect(serializarCelda(texto("Sin nada raro"))).toBe("Sin nada raro");
  });

  it("neutraliza fórmulas prefijando con '", () => {
    for (const peligroso of ["=SUMA(A1:A9)", "+34 600", "-Oferta", "@usuario", "\tTab", "\rRetorno"]) {
      expect(serializarCelda(texto(peligroso)).replace(/^"/, "").startsWith("'")).toBe(true);
    }
    expect(serializarCelda(texto('=HYPERLINK("x")'))).toBe(`"'=HYPERLINK(""x"")"`);
  });

  it("nulo o vacío es una celda vacía", () => {
    expect(serializarCelda(texto(null))).toBe("");
    expect(serializarCelda(texto(""))).toBe("");
  });
});

describe("serializarCelda: números y fechas", () => {
  it("importes con coma decimal; los negativos no se prefijan", () => {
    expect(serializarCelda(importe(-18_000))).toBe("-180,00");
    expect(serializarCelda(importe(5))).toBe("0,05");
    expect(serializarCelda(importe(-5))).toBe("-0,05");
    expect(serializarCelda(importe(123_456_789))).toBe("1234567,89");
    expect(serializarCelda(importe(null))).toBe("");
  });

  it("enteros tal cual", () => {
    expect(serializarCelda(entero(3))).toBe("3");
    expect(serializarCelda(entero(-2))).toBe("-2");
  });

  it("fechas dd/mm/aaaa hh:mm en hora de Madrid", () => {
    // 31/01/2031 23:30 en Madrid (UTC+1).
    expect(serializarCelda(fecha(new Date("2031-01-31T22:30:00Z")))).toBe("31/01/2031 23:30");
    // 15/07/2026 08:05 en Madrid (UTC+2).
    expect(serializarCelda(fecha(new Date("2026-07-15T06:05:00Z")))).toBe("15/07/2026 08:05");
    expect(serializarCelda(fecha(null))).toBe("");
  });

  it("formatearImporteCsv redondea céntimos no enteros", () => {
    expect(formatearImporteCsv(1999.6)).toBe("20,00");
  });
});
