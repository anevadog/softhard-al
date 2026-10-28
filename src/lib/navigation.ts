import type { Role } from "@/generated/prisma/enums";
import { esStaff } from "@/lib/authz";

const BASE_INTERNA = "https://softhard.local";
const RUTAS_AUTH = new Set(["/login", "/register"]);

/**
 * Normaliza un `callbackUrl` y descarta cualquier destino que no sea una ruta
 * interna. Se usa en páginas y Server Actions, donde el valor puede venir
 * manipulado desde el navegador.
 */
export function rutaInternaSegura(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();

  if (
    raw === "" ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(raw)
  ) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(raw, BASE_INTERNA);
  } catch {
    return null;
  }

  if (url.origin !== BASE_INTERNA || RUTAS_AUTH.has(url.pathname)) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Destino final tras autenticarse. Si el callback no es seguro o apunta al
 * panel sin ser staff, se usa el destino por defecto del rol.
 */
export function destinoTrasLogin(
  callbackUrl: unknown,
  role: Role | null | undefined,
): string {
  const destino = rutaInternaSegura(callbackUrl);

  if (!destino) {
    return esStaff(role) ? "/admin" : "/app";
  }

  const { pathname } = new URL(destino, BASE_INTERNA);
  const esRutaAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  if (esRutaAdmin && !esStaff(role)) {
    return "/app";
  }

  return destino;
}

const RUTA_FICHAJES_ADMIN = "/admin/fichajes";
const PATRON_SEMANA = /^\d{4}-\d{2}-\d{2}$/;
const PATRON_ID = /^[a-z0-9]{1,40}$/i;

/**
 * Vuelta a `/admin/fichajes` tras cerrar o corregir un fichaje, conservando la
 * semana y el trabajador filtrados. Solo admite esa ruta y esos dos
 * parámetros con formato válido; cualquier otro valor devuelve la ruta base.
 * `aviso` se añade como `?cerrado=1` o `?corregido=1`.
 */
export function rutaVueltaFichajes(
  value: unknown,
  aviso: "cerrado" | "corregido",
): string {
  const segura = rutaInternaSegura(value);
  const url = new URL(segura ?? RUTA_FICHAJES_ADMIN, BASE_INTERNA);
  const query = new URLSearchParams();

  if (url.pathname === RUTA_FICHAJES_ADMIN) {
    const semana = url.searchParams.get("semana");
    const trabajador = url.searchParams.get("trabajador");

    if (semana && PATRON_SEMANA.test(semana)) {
      query.set("semana", semana);
    }

    if (trabajador && PATRON_ID.test(trabajador)) {
      query.set("trabajador", trabajador);
    }
  }

  query.set(aviso, "1");

  return `${RUTA_FICHAJES_ADMIN}?${query.toString()}`;
}
