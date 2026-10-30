import type { EquipmentType, OrderStatus, ServiceStatus } from "@/generated/prisma/enums";

/**
 * Plan fijo del histórico demo (4.3b): qué se crea cada mes, sin fechas reales
 * ni aleatoriedad. `historico.ts` lo convierte en filas con fechas relativas a
 * `ahora`. El reparto sale de la tabla `MESES` y de listas que se recorren en
 * orden (equipos, presupuestos, métodos, clientes y cestas).
 */

export type MetodoSeed = "efectivo" | "bizum" | "transferencia" | "tarjeta_online";

/** Mes k (1…12) con día y hora en Madrid, o un instante reciente (horas antes de ahora). */
export type FechaSeed = { mes: number; dia: number; hora: number } | { horasAtras: number };

export type CobroSeed = {
  metodo: MetodoSeed;
  /** Staff que registra el cobro; con `tarjeta_online` no hay (pasarela). */
  por: "encargado" | "admin";
  /** Diferencia respecto al importe esperado, en euros (solo admin, con nota). */
  ajuste?: string;
  nota?: string;
};

export type RectificacionSeed = {
  motivo: string;
  /** Días después del cobro. */
  dias: number;
  reemision?: { motivo: string; dias: number };
};

export type ReparacionSeed = {
  n: number;
  fecha: FechaSeed;
  cliente: number;
  equipmentType: EquipmentType;
  brand: string;
  model: string;
  issue: string;
  modality: "domicilio" | "taller";
  /** Presupuesto en euros; nulo si aún no se ha diagnosticado. */
  presupuesto: string | null;
  estado: ServiceStatus;
  asignada: boolean;
  cobro: CobroSeed | null;
  rectificacion?: RectificacionSeed;
};

export type PedidoSeed = {
  n: number;
  fecha: FechaSeed;
  cliente: number;
  lineas: { productId: string; cantidad: number }[];
  estado: OrderStatus;
  cobro: CobroSeed | null;
  rectificacion?: RectificacionSeed;
};

/** Clientes del histórico (emails de `DEMO_USERS`), en el orden en que se reparten. */
export const CLIENTES_HISTORICO = [
  "cliente@demo.local",
  "cliente2@demo.local",
  "cliente3@demo.local",
  "cliente4@demo.local",
  "cliente5@demo.local",
  "cliente6@demo.local",
] as const;

/**
 * Códigos por mes:
 * R reparación entregada y cobrada · V venta cobrada · D diagnóstico de una
 * rechazada, cobrado · E diagnóstico de una expirada, cobrado · r rechazada sin
 * cobro · e expirada sin cobro · C pedido cancelado · K pedido caducado.
 * Casos especiales: Vx (mes 6) venta rectificada sin re-emisión · Va (mes 7)
 * venta con ajuste de importe · Rx (mes 9) reparación rectificada y re-emitida.
 */
export const MESES: Readonly<Record<number, readonly string[]>> = {
  1: ["R", "R", "V"],
  2: ["R", "R", "R", "V", "C"],
  3: ["R", "R", "V", "D"],
  4: ["R", "R", "R", "V", "V", "r"],
  5: ["R", "R", "R", "V", "E"],
  6: ["R", "R", "V", "Vx"],
  7: ["R", "R", "R", "V", "Va"],
  8: ["R", "R", "R", "R", "V", "D", "C"],
  9: ["R", "R", "Rx", "V"],
  10: ["R", "R", "R", "V", "V", "E", "e"],
  11: ["R", "R", "V", "D", "K"],
  12: ["R", "R", "V"],
};

/** Reparaciones en curso, recientes (horas antes de ahora), sin cobro ni factura. */
const EN_CURSO: readonly { estado: ServiceStatus; horasAtras: number; asignada: boolean }[] = [
  { estado: "pendiente", horasAtras: 3, asignada: false },
  { estado: "pendiente", horasAtras: 20, asignada: false },
  { estado: "diagnosticada", horasAtras: 10, asignada: false },
  { estado: "aceptada", horasAtras: 30, asignada: false },
  { estado: "aceptada", horasAtras: 26, asignada: true },
  { estado: "en_reparacion", horasAtras: 36, asignada: true },
  { estado: "esperando_repuesto", horasAtras: 40, asignada: true },
  { estado: "lista", horasAtras: 30, asignada: true },
];

/** Pedidos pendientes recientes: su `expiresAt` sigue en el futuro. */
const PENDIENTES_HORAS = [2, 6] as const;

const EQUIPOS: readonly Pick<ReparacionSeed, "equipmentType" | "brand" | "model" | "issue">[] = [
  { equipmentType: "portatil", brand: "Lenovo", model: "IdeaPad 5", issue: "No enciende tras un corte de luz." },
  { equipmentType: "ordenador", brand: "HP", model: "ProDesk 400", issue: "Se reinicia solo a los pocos minutos." },
  { equipmentType: "impresora", brand: "Brother", model: "HL-L2350DW", issue: "Atasca el papel en cada impresión." },
  { equipmentType: "portatil", brand: "Asus", model: "VivoBook 15", issue: "La pantalla muestra rayas verticales." },
  { equipmentType: "ordenador", brand: "Dell", model: "OptiPlex 3080", issue: "Tarda varios minutos en arrancar." },
  { equipmentType: "impresora", brand: "Canon", model: "PIXMA TS5350", issue: "No reconoce los cartuchos nuevos." },
  { equipmentType: "otro", brand: "Samsung", model: "Galaxy Tab A8", issue: "No carga con ningún cable." },
];

/** Todos por encima de la tarifa de diagnóstico: el importe final es > 0. */
const PRESUPUESTOS = ["89.00", "120.00", "145.50", "65.00", "210.00", "99.90", "175.00", "134.95"];

const METODOS: readonly MetodoSeed[] = ["efectivo", "bizum", "transferencia", "tarjeta_online"];

/** Sin el Monitor LG (stock 0): el histórico no vende lo que hoy está agotado. */
const CESTAS: readonly PedidoSeed["lineas"][] = [
  [{ productId: "demo-prod-toner-hp-26a", cantidad: 1 }],
  [{ productId: "demo-prod-keychron-k2", cantidad: 1 }],
  [{ productId: "demo-prod-epson-et-2850", cantidad: 1 }],
  [{ productId: "demo-prod-toner-hp-26a", cantidad: 2 }],
  [{ productId: "demo-prod-thinkpad-t14", cantidad: 1 }],
  [
    { productId: "demo-prod-keychron-k2", cantidad: 1 },
    { productId: "demo-prod-toner-hp-26a", cantidad: 1 },
  ],
  [{ productId: "demo-prod-hp-elitedesk-800", cantidad: 1 }],
];

export type PlanHistorico = {
  reparaciones: ReparacionSeed[];
  pedidos: PedidoSeed[];
};

/** Recorre una lista en orden circular. */
function ciclo<T>(lista: readonly T[], indice: number): T {
  return lista[indice % lista.length] as T;
}

export function planHistorico(): PlanHistorico {
  const reparaciones: ReparacionSeed[] = [];
  const pedidos: PedidoSeed[] = [];
  let cobros = 0;
  let clientes = 0;

  const siguienteCobro = (extra: Partial<CobroSeed> = {}): CobroSeed => ({
    metodo: ciclo(METODOS, cobros++),
    por: "encargado",
    ...extra,
  });
  const siguienteCliente = () => clientes++ % CLIENTES_HISTORICO.length;

  const nuevaReparacion = (
    fecha: FechaSeed,
    datos: Pick<ReparacionSeed, "estado" | "asignada" | "cobro"> &
      Partial<Pick<ReparacionSeed, "rectificacion" | "presupuesto">>,
  ) => {
    const n = reparaciones.length + 1;

    reparaciones.push({
      n,
      fecha,
      cliente: siguienteCliente(),
      ...ciclo(EQUIPOS, n - 1),
      modality: n % 3 === 0 ? "domicilio" : "taller",
      presupuesto: ciclo(PRESUPUESTOS, n - 1),
      ...datos,
    });
  };

  const nuevoPedido = (
    fecha: FechaSeed,
    datos: Pick<PedidoSeed, "estado" | "cobro"> & Partial<Pick<PedidoSeed, "rectificacion">>,
  ) => {
    const n = pedidos.length + 1;

    pedidos.push({ n, fecha, cliente: siguienteCliente(), lineas: ciclo(CESTAS, n - 1), ...datos });
  };

  for (let mes = 1; mes <= 12; mes++) {
    const codigos = MESES[mes] ?? [];

    codigos.forEach((codigo, i) => {
      // Días repartidos entre el 3 y el 27, a horas de apertura.
      const fecha: FechaSeed = {
        mes,
        dia: 3 + Math.floor((i * 24) / codigos.length),
        hora: 10 + ((i * 3) % 8),
      };
      const estadoVenta: OrderStatus = mes <= 10 ? "entregado" : "pagado";

      switch (codigo) {
        case "R":
          nuevaReparacion(fecha, { estado: "entregada", asignada: true, cobro: siguienteCobro() });
          break;
        case "Rx":
          nuevaReparacion(fecha, {
            estado: "entregada",
            asignada: true,
            cobro: siguienteCobro(),
            rectificacion: {
              motivo: "Datos del cliente incorrectos",
              dias: 2,
              reemision: { motivo: "Corrección de los datos del cliente", dias: 3 },
            },
          });
          break;
        case "D":
          nuevaReparacion(fecha, { estado: "rechazada", asignada: false, cobro: siguienteCobro() });
          break;
        case "E":
          nuevaReparacion(fecha, { estado: "expirada", asignada: false, cobro: siguienteCobro() });
          break;
        case "r":
          nuevaReparacion(fecha, { estado: "rechazada", asignada: false, cobro: null });
          break;
        case "e":
          nuevaReparacion(fecha, { estado: "expirada", asignada: false, cobro: null });
          break;
        case "V":
          nuevoPedido(fecha, { estado: estadoVenta, cobro: siguienteCobro() });
          break;
        case "Vx":
          nuevoPedido(fecha, {
            estado: estadoVenta,
            cobro: siguienteCobro(),
            rectificacion: { motivo: "Cambio de NIF", dias: 5 },
          });
          break;
        case "Va":
          nuevoPedido(fecha, {
            estado: estadoVenta,
            cobro: siguienteCobro({
              por: "admin",
              ajuste: "-5.00",
              nota: "Descuento de 5 € por caja dañada en el transporte",
            }),
          });
          break;
        case "C":
          nuevoPedido(fecha, { estado: "cancelado", cobro: null });
          break;
        case "K":
          nuevoPedido(fecha, { estado: "caducado", cobro: null });
          break;
        default:
          throw new Error(`Código de histórico desconocido: ${codigo}`);
      }
    });
  }

  for (const enCurso of EN_CURSO) {
    nuevaReparacion(
      { horasAtras: enCurso.horasAtras },
      {
        estado: enCurso.estado,
        asignada: enCurso.asignada,
        cobro: null,
        ...(enCurso.estado === "pendiente" ? { presupuesto: null } : {}),
      },
    );
  }

  for (const horasAtras of PENDIENTES_HORAS) {
    nuevoPedido({ horasAtras }, { estado: "pendiente", cobro: null });
  }

  return { reparaciones, pedidos };
}
