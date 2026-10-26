import Link from "next/link";

import { describirInactividad, limiteInactividad } from "@/lib/inactivity";
import { EQUIPMENT_LABELS, etiquetaEstado } from "@/lib/service-requests";
import {
  listarMisReparacionesDescuidadas,
  obtenerHorasInactividad,
} from "@/server/data/inactivity";

/**
 * Aviso de reparaciones propias sin actividad. Cada página de /trabajador lo
 * renderiza (no el layout, que Next no vuelve a renderizar al navegar entre
 * páginas): así se evalúa en cada carga y desaparece tras cualquier actividad.
 */
export async function InactivityBanner({ userId }: { userId: string }) {
  const horas = await obtenerHorasInactividad();
  const ahora = new Date();
  const { elementos, total } = await listarMisReparacionesDescuidadas(
    userId,
    limiteInactividad(ahora, horas),
  );

  if (total === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="aviso-inactividad"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
      role="alert"
    >
      <h2 id="aviso-inactividad" className="font-semibold">
        {total === 1
          ? `Tienes 1 reparación sin actividad desde hace más de ${horas} h`
          : `Tienes ${total} reparaciones sin actividad desde hace más de ${horas} h`}
      </h2>
      <p className="mt-1 text-amber-800">
        Actualiza su estado, deja una nota o devuélvela al encargado.
      </p>
      <ul className="mt-3 space-y-1.5">
        {elementos.map((reparacion) => (
          <li key={reparacion.id}>
            <Link
              href={`/trabajador/reparaciones/${reparacion.id}`}
              className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-white/70 px-3 py-2 transition-colors hover:bg-white"
            >
              <span className="font-medium text-amber-950">
                {EQUIPMENT_LABELS[reparacion.equipmentType]} · {reparacion.brand}{" "}
                {reparacion.model}
              </span>
              <span className="text-xs text-amber-800">
                {etiquetaEstado(reparacion.status)} ·{" "}
                {describirInactividad(reparacion.lastActivityAt, ahora)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {total > elementos.length ? (
        <p className="mt-2 text-xs text-amber-800">
          y {total - elementos.length} más.
        </p>
      ) : null}
    </section>
  );
}
