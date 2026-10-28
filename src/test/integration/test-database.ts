// Import relativo: este módulo también lo carga vitest.integration.config.mts,
// donde aún no existe el alias "@/".
import { esHostLocal } from "../../lib/seed-guard";

/** Sufijo obligatorio del nombre de la base de los tests de integración. */
export const SUFIJO_BD_TEST = "_test";

/**
 * URL de la base de integración a partir de `DATABASE_URL`: mismo servidor y
 * credenciales, nombre con sufijo `_test`. Así no hace falta tocar `.env`.
 * Rechaza hosts no locales: los tests escriben (aunque siempre con rollback).
 */
export function derivarUrlDeTest(databaseUrl: string | undefined): {
  url: string;
  nombre: string;
} {
  if (!databaseUrl) {
    throw new Error("Tests de integración: falta DATABASE_URL.");
  }

  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Tests de integración: DATABASE_URL no es una URL válida.");
  }

  if (!esHostLocal(url.hostname)) {
    throw new Error(
      `Tests de integración bloqueados: el host "${url.hostname}" no es local.`,
    );
  }

  const actual = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!actual) {
    throw new Error("Tests de integración: DATABASE_URL no indica la base de datos.");
  }

  const nombre = actual.endsWith(SUFIJO_BD_TEST) ? actual : `${actual}${SUFIJO_BD_TEST}`;
  url.pathname = `/${encodeURIComponent(nombre)}`;

  return { url: url.toString(), nombre };
}

/** Guarda en tiempo de ejecución: nunca se escribe en una base sin sufijo `_test`. */
export function asegurarBdDeTest(databaseUrl: string | undefined): void {
  const nombre = databaseUrl ? new URL(databaseUrl).pathname.replace(/^\//, "") : "";

  if (!databaseUrl || !nombre.endsWith(SUFIJO_BD_TEST) || !esHostLocal(new URL(databaseUrl).hostname)) {
    throw new Error(
      "Tests de integración bloqueados: DATABASE_URL no apunta a una base local *_test.",
    );
  }
}
