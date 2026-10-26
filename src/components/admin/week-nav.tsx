import Link from "next/link";

import { formatearFechaCorta } from "@/lib/format";
import { desplazarSemana, semanaDe, type SemanaTaller } from "@/lib/work-logs";

/**
 * Navegación entre semanas (lunes a domingo en Madrid). Conserva el resto de
 * parámetros de la URL y no deja avanzar más allá de la semana actual.
 */
export function WeekNav({
  ruta,
  semana,
  ahora,
  parametros = {},
}: {
  ruta: string;
  semana: SemanaTaller;
  ahora: Date;
  parametros?: Record<string, string | undefined>;
}) {
  const esActual = semana.clave === semanaDe(ahora).clave;

  const href = (clave: string | null) => {
    const query = new URLSearchParams();

    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor) {
        query.set(clave, valor);
      }
    }

    if (clave) {
      query.set("semana", clave);
    }

    const texto = query.toString();

    return texto ? `${ruta}?${texto}` : ruta;
  };

  const boton =
    "rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-100";

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        Semana del {formatearFechaCorta(semana.inicio)} al{" "}
        {formatearFechaCorta(new Date(semana.fin.getTime() - 1))} (hora de Madrid).
      </p>
      <nav aria-label="Semanas" className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={href(desplazarSemana(semana, -1).clave)} className={boton}>
          ← Anterior
        </Link>
        {esActual ? (
          <span className="rounded-lg border border-slate-200 px-3 py-2 text-slate-400">
            Siguiente →
          </span>
        ) : (
          <>
            <Link href={href(desplazarSemana(semana, 1).clave)} className={boton}>
              Siguiente →
            </Link>
            <Link href={href(null)} className="text-slate-600 hover:text-slate-900">
              Esta semana
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
