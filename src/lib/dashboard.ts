import type { InvoiceConcept, InvoiceSeries } from "@/generated/prisma/enums";
import { instanteDesdeHoraMadrid, partesEnMadrid } from "@/lib/work-logs";

/**
 * Reglas puras del dashboard de ingresos (4.1). El ingreso es la suma de
 * `Invoice.total` por `issuedAt`, con todas las series: las rectificativas
 * restan en el mes de su emisión. Importes en céntimos enteros; los meses son
 * naturales en Europe/Madrid.
 */

export const PERIODOS = ["mes-actual", "mes-anterior", "12-meses", "anio"] as const;

export type ClavePeriodo = (typeof PERIODOS)[number];

export const PERIODO_LABELS: Record<ClavePeriodo, string> = {
  "mes-actual": "Mes actual",
  "mes-anterior": "Mes anterior",
  "12-meses": "Últimos 12 meses",
  anio: "Año natural",
};

export type MesDashboard = {
  /** `YYYY-MM`, igual que el `to_char` de la consulta. */
  clave: string;
  year: number;
  month: number;
  /** Día 1 a las 00:00 en Madrid (incluido). */
  inicio: Date;
  /** Día 1 del mes siguiente a las 00:00 en Madrid (excluido). */
  fin: Date;
};

export type PeriodoDashboard = {
  clave: ClavePeriodo;
  inicio: Date;
  fin: Date;
  meses: MesDashboard[];
};

function mesDesdeIndice(indice: number): MesDashboard {
  const year = Math.floor(indice / 12);
  const month = (indice % 12) + 1;

  return {
    clave: `${year}-${String(month).padStart(2, "0")}`,
    year,
    month,
    inicio: instanteDesdeHoraMadrid(year, month, 1),
    fin: instanteDesdeHoraMadrid(year, month + 1, 1),
  };
}

/**
 * Periodo a partir de `?periodo=`. Un valor ausente o desconocido es el mes
 * actual. "Año natural" va de enero al mes actual, sin meses futuros.
 */
export function periodoDesdeParam(valor: string | null | undefined, ahora: Date): PeriodoDashboard {
  const clave = PERIODOS.find((periodo) => periodo === valor) ?? "mes-actual";
  const actual = partesEnMadrid(ahora);
  const indiceActual = actual.year * 12 + (actual.month - 1);

  const [desde, hasta] = {
    "mes-actual": [indiceActual, indiceActual],
    "mes-anterior": [indiceActual - 1, indiceActual - 1],
    "12-meses": [indiceActual - 11, indiceActual],
    anio: [actual.year * 12, indiceActual],
  }[clave];

  const meses: MesDashboard[] = [];
  for (let indice = desde; indice <= hasta; indice++) {
    meses.push(mesDesdeIndice(indice));
  }

  return {
    clave,
    inicio: meses[0]!.inicio,
    fin: meses[meses.length - 1]!.fin,
    meses,
  };
}

/** Fila agregada de la consulta: un mes, un concepto y una serie. */
export type FilaIngresos = {
  mes: string;
  concept: InvoiceConcept;
  series: InvoiceSeries;
  totalCentimos: number;
  facturas: number;
};

export type ResumenIngresos = {
  netoCentimos: number;
  ventasCentimos: number;
  reparacionesCentimos: number;
  diagnosticosCentimos: number;
  /** Suma de las rectificativas del periodo (≤ 0), ya incluida en el neto. */
  rectificadoCentimos: number;
  facturasPorSerie: Record<InvoiceSeries, number>;
  facturas: number;
};

/** Tarjetas del periodo. Cada concepto es neto de sus rectificativas. */
export function resumirIngresos(filas: readonly FilaIngresos[]): ResumenIngresos {
  const resumen: ResumenIngresos = {
    netoCentimos: 0,
    ventasCentimos: 0,
    reparacionesCentimos: 0,
    diagnosticosCentimos: 0,
    rectificadoCentimos: 0,
    facturasPorSerie: { FAC: 0, RECT: 0, MIG: 0 },
    facturas: 0,
  };

  for (const fila of filas) {
    resumen.netoCentimos += fila.totalCentimos;
    resumen.facturas += fila.facturas;
    resumen.facturasPorSerie[fila.series] += fila.facturas;

    if (fila.series === "RECT") {
      resumen.rectificadoCentimos += fila.totalCentimos;
    }

    if (fila.concept === "venta") {
      resumen.ventasCentimos += fila.totalCentimos;
    } else if (fila.concept === "reparacion") {
      resumen.reparacionesCentimos += fila.totalCentimos;
    } else {
      resumen.diagnosticosCentimos += fila.totalCentimos;
    }
  }

  return resumen;
}

export type IngresosMes = {
  mes: MesDashboard;
  ventasCentimos: number;
  /** Reparaciones más diagnósticos: la serie del taller en el gráfico. */
  tallerCentimos: number;
  netoCentimos: number;
};

/** Un elemento por mes del periodo, también los que no tienen facturas (a 0). */
export function ingresosPorMes(
  filas: readonly FilaIngresos[],
  meses: readonly MesDashboard[],
): IngresosMes[] {
  return meses.map((mes) => {
    const delMes = filas.filter((fila) => fila.mes === mes.clave);
    const ventasCentimos = delMes
      .filter((fila) => fila.concept === "venta")
      .reduce((suma, fila) => suma + fila.totalCentimos, 0);
    const tallerCentimos = delMes
      .filter((fila) => fila.concept !== "venta")
      .reduce((suma, fila) => suma + fila.totalCentimos, 0);

    return { mes, ventasCentimos, tallerCentimos, netoCentimos: ventasCentimos + tallerCentimos };
  });
}

export type Escala = { min: number; max: number; paso: number; marcas: number[] };

/** Paso "redondo" (1, 2 o 5 por una potencia de 10) cercano a `bruto`. */
function pasoRedondo(bruto: number): number {
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const fraccion = bruto / potencia;
  const factor = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;

  return factor * potencia;
}

/**
 * Eje Y con marcas redondas que incluye siempre el 0 (y los negativos si los
 * hay). Valores en céntimos; con todo a 0, la escala va de 0 a 100 €.
 */
export function escalaRedonda(valores: readonly number[], marcasObjetivo = 5): Escala {
  const minimo = Math.min(0, ...valores);
  const maximo = Math.max(0, ...valores);

  if (minimo === 0 && maximo === 0) {
    return escalaRedonda([10_000], marcasObjetivo);
  }

  const paso = pasoRedondo((maximo - minimo) / marcasObjetivo);
  const min = Math.floor(minimo / paso) * paso;
  const max = Math.ceil(maximo / paso) * paso;

  const marcas: number[] = [];
  for (let marca = min; marca <= max; marca += paso) {
    marcas.push(marca + 0);
  }

  return { min: min + 0, max, paso, marcas };
}
