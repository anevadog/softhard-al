type EntornoSeed = {
  DATABASE_URL?: string;
  SEED_ALLOW_PRODUCTION?: string;
  // Se aceptan, pero no deciden: la protección se basa en el host de la URL.
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

export type ResultadoGuardSeed =
  | { permitido: true; host: string }
  | {
      permitido: false;
      motivo: "url-ausente" | "url-invalida" | "host-no-local";
      host?: string;
    };

/** Hosts que pueden recibir el seed sin confirmación explícita. */
const HOSTS_LOCALES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "db", // nombre del servicio en docker-compose.yml
]);

function normalizarHost(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");
}

export function esHostLocal(hostname: string): boolean {
  return HOSTS_LOCALES.has(normalizarHost(hostname));
}

/**
 * El seed carga usuarios y productos de demostración. Solo puede ejecutarse sin
 * confirmación si DATABASE_URL apunta a un host local. Un host remoto exige
 * SEED_ALLOW_PRODUCTION=true, y una URL ausente o inválida se rechaza siempre.
 */
export function evaluarSeed(
  entorno: EntornoSeed = process.env,
): ResultadoGuardSeed {
  const databaseUrl = entorno.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return { permitido: false, motivo: "url-ausente" };
  }

  let host: string;

  try {
    const url = new URL(databaseUrl);
    host = normalizarHost(url.hostname);
  } catch {
    return { permitido: false, motivo: "url-invalida" };
  }

  if (!host) {
    return { permitido: false, motivo: "url-invalida" };
  }

  if (esHostLocal(host) || entorno.SEED_ALLOW_PRODUCTION === "true") {
    return { permitido: true, host };
  }

  return { permitido: false, motivo: "host-no-local", host };
}
