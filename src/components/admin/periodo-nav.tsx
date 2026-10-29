import Link from "next/link";

import { PERIODOS, PERIODO_LABELS, type ClavePeriodo } from "@/lib/dashboard";

/** Selector de periodo del dashboard por URL (`?periodo=`), como `WeekNav`. */
export function PeriodoNav({ ruta, actual }: { ruta: string; actual: ClavePeriodo }) {
  return (
    <nav aria-label="Periodo" className="flex flex-wrap gap-2 text-sm">
      {PERIODOS.map((periodo) => {
        const activo = periodo === actual;

        return (
          <Link
            key={periodo}
            href={periodo === "mes-actual" ? ruta : `${ruta}?periodo=${periodo}`}
            aria-current={activo ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 ring-1 transition-colors ${
              activo
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {PERIODO_LABELS[periodo]}
          </Link>
        );
      })}
    </nav>
  );
}
