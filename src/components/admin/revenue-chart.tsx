import { escalaRedonda, type IngresosMes } from "@/lib/dashboard";
import { formatEuros, formatearMes, formatearMesCorto } from "@/lib/format";

/**
 * Barras agrupadas por mes (ventas frente a taller: reparaciones +
 * diagnósticos), netas de rectificativas. SVG propio en un Server Component:
 * un mes negativo dibuja la barra por debajo del eje 0. Cada barra lleva su
 * `<title>` (tooltip nativo) y debajo va la tabla equivalente.
 */

const ANCHO = 720;
const ALTO = 280;
const MARGEN = { arriba: 16, derecha: 8, abajo: 32, izquierda: 72 };

const SERIES = [
  { clave: "ventasCentimos", etiqueta: "Ventas", clase: "fill-sky-600", muestra: "bg-sky-600" },
  {
    clave: "tallerCentimos",
    etiqueta: "Reparaciones y diagnósticos",
    clase: "fill-emerald-600",
    muestra: "bg-emerald-600",
  },
] as const;

const eurosEje = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const euros = (centimos: number) => formatEuros(centimos / 100);

export function RevenueChart({ meses }: { meses: readonly IngresosMes[] }) {
  const escala = escalaRedonda(meses.flatMap((m) => [m.ventasCentimos, m.tallerCentimos]));
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const y = (centimos: number) =>
    MARGEN.arriba + ((escala.max - centimos) / (escala.max - escala.min)) * altoUtil;

  const anchoGrupo = anchoUtil / Math.max(meses.length, 1);
  const anchoBarra = Math.min(28, (anchoGrupo * 0.7) / SERIES.length);

  return (
    <figure className="space-y-4">
      <ul className="flex flex-wrap gap-4 text-xs text-slate-600" aria-label="Leyenda">
        {SERIES.map((serie) => (
          <li key={serie.clave} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${serie.muestra}`} aria-hidden="true" />
            {serie.etiqueta}
          </li>
        ))}
      </ul>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="h-auto w-full"
        role="img"
        aria-label="Ingresos netos por mes: ventas frente a reparaciones y diagnósticos"
      >
        {escala.marcas.map((marca) => (
          <g key={marca}>
            <line
              x1={MARGEN.izquierda}
              x2={ANCHO - MARGEN.derecha}
              y1={y(marca)}
              y2={y(marca)}
              className={marca === 0 ? "stroke-slate-400" : "stroke-slate-200"}
              strokeWidth={1}
            />
            <text
              x={MARGEN.izquierda - 8}
              y={y(marca)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-500 text-[11px]"
            >
              {eurosEje.format(marca / 100)}
            </text>
          </g>
        ))}

        {meses.map((mes, i) => {
          const centro = MARGEN.izquierda + anchoGrupo * (i + 0.5);

          return (
            <g key={mes.mes.clave}>
              {SERIES.map((serie, s) => {
                const valor = mes[serie.clave];
                const x = centro - (anchoBarra * SERIES.length) / 2 + s * anchoBarra;
                const arriba = y(Math.max(valor, 0));
                const alto = Math.abs(y(valor) - y(0));

                return (
                  <rect
                    key={serie.clave}
                    x={x + 1}
                    y={arriba}
                    width={Math.max(anchoBarra - 2, 1)}
                    height={Math.max(alto, valor === 0 ? 0 : 1)}
                    className={serie.clase}
                  >
                    <title>{`${formatearMes(mes.mes.inicio)} · ${serie.etiqueta}: ${euros(valor)}`}</title>
                  </rect>
                );
              })}
              <text
                x={centro}
                y={ALTO - MARGEN.abajo + 18}
                textAnchor="middle"
                className="fill-slate-500 text-[11px]"
              >
                {formatearMesCorto(mes.mes.inicio)}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="sr-only">
        Importes con IVA incluido. Las rectificativas restan en el mes de su emisión.
      </figcaption>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Ingresos netos por mes</caption>
          <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="py-2">
                Mes
              </th>
              <th scope="col" className="py-2 text-right">
                Ventas
              </th>
              <th scope="col" className="py-2 text-right">
                Reparaciones y diagnósticos
              </th>
              <th scope="col" className="py-2 text-right">
                Neto
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {meses.map((mes) => (
              <tr key={mes.mes.clave}>
                <th scope="row" className="py-2 text-left font-normal text-slate-900 first-letter:uppercase">
                  {formatearMes(mes.mes.inicio)}
                </th>
                <td className="py-2 text-right text-slate-700">{euros(mes.ventasCentimos)}</td>
                <td className="py-2 text-right text-slate-700">{euros(mes.tallerCentimos)}</td>
                <td
                  className={`py-2 text-right font-medium ${mes.netoCentimos < 0 ? "text-red-700" : "text-slate-900"}`}
                >
                  {euros(mes.netoCentimos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
