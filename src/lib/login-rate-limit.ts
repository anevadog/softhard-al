/**
 * Política pura del límite de intentos de inicio de sesión. Se cuentan solo
 * los fallos recientes; el límite se aplica igual exista o no la cuenta, para
 * no revelar qué emails están registrados.
 */

/** Código de `CredentialsSignin` que la acción de login traduce a "Demasiados intentos". */
export const CODIGO_DEMASIADOS_INTENTOS = "rate_limited";

export const VENTANA_LOGIN_MINUTOS = 15;
export const MAX_FALLOS_POR_EMAIL = 5;
export const MAX_FALLOS_POR_IP = 20;
/** Antigüedad a partir de la cual los intentos se borran de forma perezosa. */
export const RETENCION_INTENTOS_HORAS = 24;

/** Longitud máxima guardada para la IP (IPv6 con zona cabe de sobra). */
const LONGITUD_MAXIMA_IP = 64;

export type FallosRecientes = {
  porEmail: number;
  /** `null` si la petición no trae IP: solo se limita por email. */
  porIp: number | null;
};

export type EvaluacionLimite =
  | { bloqueado: false }
  | { bloqueado: true; motivo: "email" | "ip" };

export function inicioVentana(ahora: Date): Date {
  return new Date(ahora.getTime() - VENTANA_LOGIN_MINUTOS * 60_000);
}

export function limiteRetencion(ahora: Date): Date {
  return new Date(ahora.getTime() - RETENCION_INTENTOS_HORAS * 3_600_000);
}

/** Bloquea al alcanzar el máximo: con 5 fallos previos, el sexto intento ya no se evalúa. */
export function evaluarLimite(fallos: FallosRecientes): EvaluacionLimite {
  if (fallos.porEmail >= MAX_FALLOS_POR_EMAIL) {
    return { bloqueado: true, motivo: "email" };
  }

  if (fallos.porIp !== null && fallos.porIp >= MAX_FALLOS_POR_IP) {
    return { bloqueado: true, motivo: "ip" };
  }

  return { bloqueado: false };
}

/**
 * IP del cliente a partir de las cabeceras del proxy. Toma la primera de
 * `x-forwarded-for` (la del cliente original) o `x-real-ip`; si no hay, `null`.
 */
export function ipDesdeCabeceras(cabeceras: Pick<Headers, "get"> | undefined): string | null {
  const reenviada = cabeceras?.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = cabeceras?.get("x-real-ip")?.trim();
  const ip = reenviada || real;

  return ip ? ip.slice(0, LONGITUD_MAXIMA_IP) : null;
}
