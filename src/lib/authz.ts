import type { Role } from "@/generated/prisma/enums";

/** Roles con acceso al panel interno. En Fase 1 `admin` equivale a `encargado`. */
export const ROLES_STAFF: readonly Role[] = ["encargado", "admin"];

/** Roles con acceso al área de taller. */
export const ROLES_TALLER: readonly Role[] = ["trabajador", "encargado", "admin"];

export function esStaff(role: Role | null | undefined): boolean {
  return role === "encargado" || role === "admin";
}

export function esPersonalTaller(
  role: Role | null | undefined,
): role is "trabajador" | "encargado" | "admin" {
  return role === "trabajador" || role === "encargado" || role === "admin";
}

/**
 * Regla de acceso a rutas protegidas. Función pura a propósito: el middleware
 * corre en Edge y esto se puede testear sin el runtime de Next.
 */
export function puedeAcceder(pathname: string, role: Role | null | undefined): boolean {
  if (!role) return false;

  const esRutaAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const esRutaTaller =
    pathname === "/trabajador" || pathname.startsWith("/trabajador/");

  if (esRutaAdmin) return esStaff(role);
  if (esRutaTaller) return esPersonalTaller(role);

  return true;
}
