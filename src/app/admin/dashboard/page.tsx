import Link from "next/link";
import type { ReactNode } from "react";

import { PeriodoNav } from "@/components/admin/periodo-nav";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { ingresosPorMes, periodoDesdeParam, resumirIngresos } from "@/lib/dashboard";
import { formatEuros, formatearFechaCorta } from "@/lib/format";
import { requerirStaff } from "@/server/authorization";
import {
  contarPedidosPerdidos,
  obtenerFilasIngresos,
  resumirPendientesCobro,
} from "@/server/data/dashboard";
import { liberarPedidosCaducadosSinFallar } from "@/server/data/orders";

export const metadata = {
  title: "Dashboard",
};

const euros = (centimos: number) => formatEuros(centimos / 100);

const contar = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: clave } = await searchParams;
  await requerirStaff();

  const periodo = periodoDesdeParam(clave, new Date());

  // Caducidad perezosa: así los pedidos caducados del periodo están al día.
  await liberarPedidosCaducadosSinFallar();

  const [filas, perdidos, pendientes] = await Promise.all([
    obtenerFilasIngresos(periodo),
    contarPedidosPerdidos(periodo),
    resumirPendientesCobro(),
  ]);
  const resumen = resumirIngresos(filas);
  const porMes = ingresosPorMes(filas, periodo.meses);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ingresos según las facturas emitidas, con IVA incluido. Las rectificativas restan en
          el mes en que se emiten.
        </p>
      </div>

      <div className="space-y-2">
        <PeriodoNav ruta="/admin/dashboard" actual={periodo.clave} />
        <p className="text-sm text-slate-600">
          Del {formatearFechaCorta(periodo.inicio)} al{" "}
          {formatearFechaCorta(new Date(periodo.fin.getTime() - 1))} (hora de Madrid).
        </p>
      </div>

      {resumen.facturas === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No hay facturas emitidas en este periodo.
        </p>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tarjeta titulo="Ingresos netos" destacada>
              {euros(resumen.netoCentimos)}
            </Tarjeta>
            <Tarjeta titulo="Ventas">{euros(resumen.ventasCentimos)}</Tarjeta>
            <Tarjeta titulo="Reparaciones">{euros(resumen.reparacionesCentimos)}</Tarjeta>
            <Tarjeta titulo="Diagnósticos">{euros(resumen.diagnosticosCentimos)}</Tarjeta>
            <Tarjeta titulo="Rectificado (ya restado)">
              <span className={resumen.rectificadoCentimos < 0 ? "text-red-700" : undefined}>
                {euros(resumen.rectificadoCentimos)}
              </span>
            </Tarjeta>
            <Tarjeta titulo="Facturas">
              <span className="text-base font-medium">
                {contar(resumen.facturasPorSerie.FAC, "ordinaria", "ordinarias")} ·{" "}
                {contar(resumen.facturasPorSerie.RECT, "rectificativa", "rectificativas")} ·{" "}
                {contar(resumen.facturasPorSerie.MIG, "retroactiva", "retroactivas")}
              </span>
            </Tarjeta>
          </ul>

          <Seccion id="por-mes" titulo="Ingresos netos por mes">
            <RevenueChart meses={porMes} />
          </Seccion>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion id="pedidos-perdidos" titulo="Pedidos perdidos en el periodo">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <dt className="text-slate-600">Cancelados</dt>
              <dd className="text-lg font-semibold text-slate-900">{perdidos.cancelados}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <dt className="text-slate-600">Caducados (impago)</dt>
              <dd className="text-lg font-semibold text-slate-900">{perdidos.caducados}</dd>
            </div>
          </dl>
        </Seccion>

        <Seccion id="pendientes-cobro" titulo="Pendientes de cobro (ahora)">
          {pendientes.total === 0 ? (
            <p className="text-sm text-slate-600">No hay reparaciones listas sin cobrar.</p>
          ) : (
            <p className="text-sm text-slate-700">
              {pendientes.total === 1
                ? "1 reparación lista"
                : `${pendientes.total} reparaciones listas`}{" "}
              sin cobrar, por {euros(pendientes.importeCentimos)}.{" "}
              <Link
                href="/admin/solicitudes?cobro=pendiente"
                className="font-medium text-slate-900 underline"
              >
                Ver cuáles
              </Link>
            </p>
          )}
        </Seccion>
      </div>
    </div>
  );
}

function Tarjeta({
  titulo,
  destacada = false,
  children,
}: {
  titulo: string;
  destacada?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={`rounded-xl border p-4 ${destacada ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}
    >
      <p className={`text-sm ${destacada ? "text-slate-300" : "text-slate-600"}`}>{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${destacada ? "text-white" : "text-slate-900"}`}>
        {children}
      </p>
    </li>
  );
}

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
    >
      <h2 id={`${id}-titulo`} className="text-base font-semibold text-slate-900">
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
