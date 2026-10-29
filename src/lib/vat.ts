/**
 * Desglose de IVA para precios B2C (PVP con IVA incluido). Todo en céntimos
 * enteros. El redondeo es "medio alejándose de cero", el mismo que `ROUND()`
 * de PostgreSQL sobre `numeric`: así una rectificativa es el negativo exacto
 * de su original y el SQL de las facturas retroactivas coincide con la app.
 */

/** Tipo de IVA en puntos básicos (21,00 % → 2100), exacto y entero. */
export function tipoEnPuntosBasicos(tipo: number): number {
  return Math.round(tipo * 100);
}

/** Divide redondeando a la mitad alejándose de cero, sin errores de coma flotante. */
function dividirRedondeando(numerador: number, denominador: number): number {
  const signo = Math.sign(numerador);
  const absoluto = Math.abs(numerador);
  const cociente = Math.floor(absoluto / denominador);
  const resto = absoluto - cociente * denominador;

  const redondeado = 2 * resto >= denominador ? cociente + 1 : cociente;

  // `+ 0` evita devolver −0 cuando el resultado es cero con numerador negativo.
  return signo * redondeado + 0;
}

export type Desglose = {
  totalCentimos: number;
  baseCentimos: number;
  ivaCentimos: number;
};

/** base = total / (1 + tipo), redondeada; IVA = total − base. */
export function desglosarTotal(totalCentimos: number, tipo: number): Desglose {
  const puntos = tipoEnPuntosBasicos(tipo);
  const baseCentimos = dividirRedondeando(totalCentimos * 10_000, 10_000 + puntos);

  return {
    totalCentimos,
    baseCentimos,
    ivaCentimos: totalCentimos - baseCentimos,
  };
}

/** Suma de desgloses: los totales de una factura son la suma de sus líneas. */
export function sumarDesgloses(desgloses: readonly Desglose[]): Desglose {
  return desgloses.reduce(
    (suma, d) => ({
      totalCentimos: suma.totalCentimos + d.totalCentimos,
      baseCentimos: suma.baseCentimos + d.baseCentimos,
      ivaCentimos: suma.ivaCentimos + d.ivaCentimos,
    }),
    { totalCentimos: 0, baseCentimos: 0, ivaCentimos: 0 },
  );
}

export function aCentimos(importe: number): number {
  return Math.round(importe * 100);
}
