import { MAX_DIAS_EXPORTACION } from "@/lib/exports";

const campoClass =
  "mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

/**
 * "Exportar CSV": formulario GET hacia un route handler de `/admin/exportar`,
 * sin JavaScript. Lleva el rango de fechas y, ocultos, los filtros actuales del
 * listado. El servidor revalida todo (rango ≤ 366 días, filtros y permisos).
 */
export function ExportCsvForm({
  accion,
  desde,
  hasta,
  filtros = {},
  descripcion,
}: {
  accion: string;
  desde: string;
  hasta: string;
  filtros?: Record<string, string | undefined>;
  descripcion: string;
}) {
  return (
    <form
      method="get"
      action={accion}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm print:hidden"
    >
      {Object.entries(filtros).map(([nombre, valor]) =>
        valor ? <input key={nombre} type="hidden" name={nombre} value={valor} /> : null,
      )}
      <label className="text-slate-700">
        Desde
        <input type="date" name="desde" required defaultValue={desde} className={`block ${campoClass}`} />
      </label>
      <label className="text-slate-700">
        Hasta
        <input type="date" name="hasta" required defaultValue={hasta} className={`block ${campoClass}`} />
      </label>
      <button
        type="submit"
        className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-800 transition-colors hover:bg-slate-100"
      >
        Exportar CSV
      </button>
      <p className="basis-full text-xs text-slate-500">
        {descripcion} Máximo {MAX_DIAS_EXPORTACION} días; importes con IVA incluido.
      </p>
    </form>
  );
}
