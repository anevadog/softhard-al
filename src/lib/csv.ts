import { partesEnMadrid } from "@/lib/work-logs";

/**
 * CSV pensado para el Excel en español (4.2): separador `;`, UTF-8 con BOM,
 * decimales con coma, fechas `dd/mm/aaaa hh:mm` en Europe/Madrid, comillas
 * según RFC 4180 y líneas terminadas en CRLF.
 *
 * Inyección de fórmulas: una celda de texto que empieza por `=`, `+`, `-`, `@`,
 * tabulador o retorno de carro se prefija con `'`. Los importes y enteros son
 * celdas numéricas y nunca se prefijan, así que un negativo sigue siendo un
 * número en Excel.
 */

export type Celda =
  | { tipo: "texto"; valor: string | null }
  | { tipo: "importe"; centimos: number | null }
  | { tipo: "entero"; valor: number | null }
  | { tipo: "fecha"; valor: Date | null };

export const texto = (valor: string | null | undefined): Celda => ({ tipo: "texto", valor: valor ?? null });
export const importe = (centimos: number | null | undefined): Celda => ({
  tipo: "importe",
  centimos: centimos ?? null,
});
export const entero = (valor: number | null | undefined): Celda => ({ tipo: "entero", valor: valor ?? null });
export const fecha = (valor: Date | null | undefined): Celda => ({ tipo: "fecha", valor: valor ?? null });

export const SEPARADOR = ";";
const BOM = "﻿";
const FIN_LINEA = "\r\n";

const PELIGROSO = /^[=+\-@\t\r]/;
const NECESITA_COMILLAS = /[;"\r\n]/;

/** Importe en céntimos → `1234,50` / `-180,00`, sin separador de miles. */
export function formatearImporteCsv(centimos: number): string {
  const signo = centimos < 0 ? "-" : "";
  const absoluto = Math.abs(Math.round(centimos));

  return `${signo}${Math.floor(absoluto / 100)},${String(absoluto % 100).padStart(2, "0")}`;
}

/** `dd/mm/aaaa hh:mm` en hora de Madrid. */
export function formatearFechaCsv(instante: Date): string {
  const p = partesEnMadrid(instante);
  const dos = (n: number) => String(n).padStart(2, "0");

  return `${dos(p.day)}/${dos(p.month)}/${p.year} ${dos(p.hour)}:${dos(p.minute)}`;
}

function entrecomillar(valor: string): string {
  return NECESITA_COMILLAS.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

export function serializarCelda(celda: Celda): string {
  switch (celda.tipo) {
    case "texto": {
      if (!celda.valor) return "";
      const neutralizado = PELIGROSO.test(celda.valor) ? `'${celda.valor}` : celda.valor;
      return entrecomillar(neutralizado);
    }
    case "importe":
      return celda.centimos === null ? "" : formatearImporteCsv(celda.centimos);
    case "entero":
      return celda.valor === null ? "" : String(Math.trunc(celda.valor));
    case "fecha":
      return celda.valor === null ? "" : formatearFechaCsv(celda.valor);
  }
}

export function generarCsv(cabeceras: readonly string[], filas: readonly (readonly Celda[])[]): string {
  const lineas = [cabeceras.map(texto), ...filas].map((fila) =>
    fila.map(serializarCelda).join(SEPARADOR),
  );

  return BOM + lineas.join(FIN_LINEA) + FIN_LINEA;
}
