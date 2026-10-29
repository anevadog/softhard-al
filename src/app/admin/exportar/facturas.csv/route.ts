import { exportarIngresos } from "@/server/exports/csv-exports";

/** El listado de facturas exporta lo mismo que `ingresos.csv` (spec 4.3). */
export const GET = exportarIngresos;
