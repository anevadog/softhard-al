/**
 * NIF del cliente para las facturas completas. Se acepta DNI o NIE con su
 * letra de control, o CIF con formato válido (sin comprobar su dígito de
 * control: es una demo sin validez fiscal).
 */

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";
const PREFIJOS_NIE: Record<string, string> = { X: "0", Y: "1", Z: "2" };

/** Sin espacios, puntos ni guiones, y en mayúsculas. */
export function normalizarNif(valor: string): string {
  return valor.replace(/[\s.-]/g, "").toUpperCase();
}

function letraControl(numero: string): string {
  return LETRAS_DNI[Number(numero) % 23];
}

export function esDniValido(nif: string): boolean {
  const coincide = /^(\d{8})([A-Z])$/.exec(nif);

  return Boolean(coincide && letraControl(coincide[1]) === coincide[2]);
}

export function esNieValido(nif: string): boolean {
  const coincide = /^([XYZ])(\d{7})([A-Z])$/.exec(nif);

  return Boolean(
    coincide && letraControl(PREFIJOS_NIE[coincide[1]] + coincide[2]) === coincide[3],
  );
}

export function esCifValido(nif: string): boolean {
  return /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif);
}

/** Valida un NIF ya normalizado. */
export function esNifValido(nif: string): boolean {
  return esDniValido(nif) || esNieValido(nif) || esCifValido(nif);
}
