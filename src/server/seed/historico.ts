import type { Prisma } from "@/generated/prisma/client";
import type { ServiceStatus } from "@/generated/prisma/enums";
import { precioDesdeCentimos } from "@/lib/orders";
import { fechaHistorico, haceHoras, sumarDias } from "@/lib/seed-dates";
import { aCentimos } from "@/lib/vat";
import {
  emitirFacturaDeCobroEnTx,
  emitirRectificativaEnTx,
  reemitirFacturaEnTx,
  type EntidadFacturable,
} from "@/server/data/invoices";
import {
  CLIENTES_HISTORICO,
  planHistorico,
  type CobroSeed,
  type FechaSeed,
  type PedidoSeed,
  type RectificacionSeed,
  type ReparacionSeed,
} from "@/server/seed/historico-datos";

/**
 * Histórico demo de 12 meses (4.3b): reparaciones, pedidos, cobros y facturas
 * coherentes con las reglas de la app, para que el dashboard tenga datos desde
 * el primer minuto. Se ejecuta dentro de una transacción ya abierta (la del
 * seed o la de `enTransaccion` en los tests) y no abre ninguna propia.
 *
 * Idempotente: cada entidad tiene un ID fijo (`seed-req-NNN`, `seed-ord-NNN`…)
 * y si ya existe no se toca, ni sus movimientos ni sus facturas. Las facturas
 * se emiten con las funciones de la app, en orden de fecha, y sus IDs
 * (`seed-inv-NNN`) salen del orden cronológico del plan completo.
 */

type Tx = Prisma.TransactionClient;

const MS_MINUTO = 60_000;
const MS_HORA = 60 * MS_MINUTO;
const MS_DIA = 24 * MS_HORA;

const tres = (n: number) => String(n).padStart(3, "0");

export const idReparacion = (n: number) => `seed-req-${tres(n)}`;
export const idPresupuesto = (n: number) => `seed-quote-${tres(n)}`;
export const idPedido = (n: number) => `seed-ord-${tres(n)}`;

type Contexto = {
  tx: Tx;
  ahora: Date;
  clientes: string[];
  encargadoId: string;
  adminId: string;
  trabajadorId: string;
  diagnosticFeeCentimos: number;
  expirationDays: number;
  pendingOrderHours: number;
  precios: Map<string, number>;
};

function resolverFecha(fecha: FechaSeed, ahora: Date): Date {
  return "mes" in fecha
    ? fechaHistorico(fecha.mes, fecha.dia, fecha.hora, ahora)
    : haceHoras(ahora, fecha.horasAtras);
}

/** El histórico cuenta en días; lo reciente, en horas (todo dentro de 48 h). */
const unidad = (fecha: FechaSeed) => ("mes" in fecha ? MS_DIA : MS_HORA);

function cobradoPor(ctx: Contexto, cobro: CobroSeed): string | null {
  if (cobro.metodo === "tarjeta_online") {
    return null;
  }

  return cobro.por === "admin" ? ctx.adminId : ctx.encargadoId;
}

// --- Reparaciones ------------------------------------------------------------

type Paso = { estado: ServiceStatus; antes: number; por: "encargado" | "cliente" | "trabajador" | null };

/**
 * Transiciones de cada estado final, como unidades antes de la fecha clave
 * (la última actividad). `creada` es cuándo se pidió la reparación.
 */
function pasosReparacion(
  r: ReparacionSeed,
  expirationDays: number,
): { creada: number; pasos: Paso[] } {
  const diag = (antes: number): Paso => ({ estado: "diagnosticada", antes, por: "encargado" });
  const acep = (antes: number): Paso => ({ estado: "aceptada", antes, por: "cliente" });
  const enRep = (antes: number): Paso => ({ estado: "en_reparacion", antes, por: "trabajador" });

  switch (r.estado) {
    case "entregada":
      return {
        creada: 9,
        pasos: [
          diag(8),
          acep(7),
          enRep(6),
          { estado: "lista", antes: 1, por: "trabajador" },
          { estado: "entregada", antes: 0, por: "encargado" },
        ],
      };
    case "rechazada":
      return { creada: 5, pasos: [diag(4), { estado: "rechazada", antes: 1, por: "cliente" }] };
    case "expirada":
      return {
        creada: expirationDays + 3,
        pasos: [diag(expirationDays + 2), { estado: "expirada", antes: 2, por: null }],
      };
    case "pendiente":
      return { creada: 0, pasos: [] };
    case "diagnosticada":
      return { creada: 2, pasos: [diag(0)] };
    case "aceptada":
      return { creada: 4, pasos: [diag(2), acep(r.asignada ? 1 : 0)] };
    case "en_reparacion":
      return { creada: 6, pasos: [diag(5), acep(4), enRep(0)] };
    case "esperando_repuesto":
      return {
        creada: 7,
        pasos: [diag(6), acep(5), enRep(2), { estado: "esperando_repuesto", antes: 0, por: "trabajador" }],
      };
    case "lista":
      return {
        creada: 7,
        pasos: [diag(6), acep(5), enRep(2), { estado: "lista", antes: 0, por: "trabajador" }],
      };
  }
}

/** Fecha del cobro: antes de entregar, o después del rechazo o la expiración. */
function fechaCobroReparacion(r: ReparacionSeed, clave: Date): Date {
  return r.estado === "entregada" ? new Date(clave.getTime() - 30 * MS_MINUTO) : clave;
}

async function crearReparacion(ctx: Contexto, r: ReparacionSeed): Promise<boolean> {
  const { tx } = ctx;
  const id = idReparacion(r.n);

  if (await tx.serviceRequest.findUnique({ where: { id }, select: { id: true } })) {
    return false;
  }

  const clave = resolverFecha(r.fecha, ctx.ahora);
  const u = unidad(r.fecha);
  const en = (antes: number) => new Date(clave.getTime() - antes * u);
  const { creada, pasos } = pasosReparacion(r, ctx.expirationDays);
  const clientId = ctx.clientes[r.cliente] as string;

  const fechaDe = (estado: ServiceStatus) => {
    const paso = pasos.find((p) => p.estado === estado);
    return paso ? en(paso.antes) : null;
  };
  const diagnostico = fechaDe("diagnosticada");
  const aceptada = fechaDe("aceptada");
  const rechazada = fechaDe("rechazada");
  const expiraPresupuesto = diagnostico
    ? new Date(diagnostico.getTime() + ctx.expirationDays * MS_DIA)
    : null;

  const presupuestoCentimos = r.presupuesto ? aCentimos(Number(r.presupuesto)) : null;
  const finalCentimos =
    presupuestoCentimos === null
      ? null
      : aceptada
        ? presupuestoCentimos - ctx.diagnosticFeeCentimos
        : rechazada
          ? ctx.diagnosticFeeCentimos
          : null;
  const esperadoCentimos = r.estado === "entregada" ? finalCentimos : ctx.diagnosticFeeCentimos;
  const fechaCobro = r.cobro ? fechaCobroReparacion(r, clave) : null;

  await tx.serviceRequest.create({
    data: {
      id,
      clientId,
      assigneeId: r.asignada ? ctx.trabajadorId : null,
      equipmentType: r.equipmentType,
      brand: r.brand,
      model: r.model,
      issue: r.issue,
      modality: r.modality,
      address: r.modality === "domicilio" ? `Calle Ficticia ${r.n}, Madrid` : null,
      status: r.estado,
      expiresAt: expiraPresupuesto,
      lastActivityAt: clave,
      createdAt: en(creada),
      updatedAt: clave,
      ...(r.cobro && fechaCobro && esperadoCentimos
        ? {
            paidAt: fechaCobro,
            paidAmount: precioDesdeCentimos(esperadoCentimos),
            paymentMethod: r.cobro.metodo,
            paidById: cobradoPor(ctx, r.cobro),
            paymentNote: r.cobro.nota ?? null,
          }
        : {}),
    },
  });

  if (presupuestoCentimos !== null && diagnostico && expiraPresupuesto) {
    await tx.quote.create({
      data: {
        id: idPresupuesto(r.n),
        requestId: id,
        budgetAmount: precioDesdeCentimos(presupuestoCentimos),
        diagnosticFee: precioDesdeCentimos(ctx.diagnosticFeeCentimos),
        finalAmount: finalCentimos === null ? null : precioDesdeCentimos(finalCentimos),
        status: aceptada
          ? "aceptado"
          : rechazada
            ? "rechazado"
            : r.estado === "expirada"
              ? "expirado"
              : "pendiente",
        expiresAt: expiraPresupuesto,
        decidedAt: aceptada ?? rechazada,
        createdAt: diagnostico,
        updatedAt: aceptada ?? rechazada ?? fechaDe("expirada") ?? diagnostico,
      },
    });
  }

  const autor = (por: Paso["por"]) =>
    por === "encargado"
      ? ctx.encargadoId
      : por === "trabajador"
        ? ctx.trabajadorId
        : por === "cliente"
          ? clientId
          : null;

  let anterior: ServiceStatus = "pendiente";
  for (const paso of pasos) {
    await tx.serviceStatusHistory.create({
      data: {
        requestId: id,
        fromStatus: anterior,
        toStatus: paso.estado,
        changedById: autor(paso.por),
        createdAt: en(paso.antes),
      },
    });
    anterior = paso.estado;
  }

  if (r.asignada && aceptada) {
    await tx.serviceAssignmentHistory.create({
      data: {
        requestId: id,
        fromAssigneeId: null,
        toAssigneeId: ctx.trabajadorId,
        changedById: ctx.encargadoId,
        createdAt: new Date(aceptada.getTime() + u / 4),
      },
    });
  }

  return true;
}

// --- Pedidos -----------------------------------------------------------------

/** Instantes de un pedido a partir de su fecha clave (su último cambio). */
function fechasPedido(p: PedidoSeed, clave: Date, pendingOrderHours: number) {
  switch (p.estado) {
    case "pagado":
    case "entregado": {
      const cobro = new Date(clave.getTime() - MS_HORA);
      return {
        creada: new Date(clave.getTime() - 2 * MS_HORA),
        cobro,
        actualizada: p.estado === "entregado" ? clave : cobro,
      };
    }
    case "cancelado":
      return { creada: sumarDias(clave, -1), cobro: null, actualizada: clave };
    case "caducado":
      return {
        creada: new Date(clave.getTime() - pendingOrderHours * MS_HORA),
        cobro: null,
        actualizada: clave,
      };
    case "pendiente":
      return { creada: clave, cobro: null, actualizada: clave };
  }
}

async function crearPedido(ctx: Contexto, p: PedidoSeed): Promise<Map<string, number> | null> {
  const { tx } = ctx;
  const id = idPedido(p.n);

  if (await tx.order.findUnique({ where: { id }, select: { id: true } })) {
    return null;
  }

  const clave = resolverFecha(p.fecha, ctx.ahora);
  const fechas = fechasPedido(p, clave, ctx.pendingOrderHours);
  const userId = ctx.clientes[p.cliente] as string;
  const lineas = p.lineas.map((linea) => ({
    ...linea,
    precioCentimos: ctx.precios.get(linea.productId) as number,
  }));
  const totalCentimos = lineas.reduce((suma, l) => suma + l.precioCentimos * l.cantidad, 0);
  const cobradoCentimos =
    totalCentimos + (p.cobro?.ajuste ? aCentimos(Number(p.cobro.ajuste)) : 0);

  await tx.order.create({
    data: {
      id,
      userId,
      total: precioDesdeCentimos(totalCentimos),
      status: p.estado,
      expiresAt: new Date(fechas.creada.getTime() + ctx.pendingOrderHours * MS_HORA),
      createdAt: fechas.creada,
      updatedAt: fechas.actualizada,
      ...(p.cobro && fechas.cobro
        ? {
            paidAt: fechas.cobro,
            paidAmount: precioDesdeCentimos(cobradoCentimos),
            paymentMethod: p.cobro.metodo,
            paidById: cobradoPor(ctx, p.cobro),
            paymentNote: p.cobro.nota ?? null,
          }
        : {}),
      items: {
        create: lineas.map((linea, i) => ({
          id: `${id}-${i + 1}`,
          productId: linea.productId,
          quantity: linea.cantidad,
          price: precioDesdeCentimos(linea.precioCentimos),
        })),
      },
    },
  });

  // Libro de stock: la venta al crear y, si no se cobró, la reposición.
  const variacion = new Map<string, number>();
  for (const linea of lineas) {
    await tx.stockMovement.create({
      data: {
        productId: linea.productId,
        variation: -linea.cantidad,
        reason: "venta",
        orderId: id,
        userId,
        createdAt: fechas.creada,
      },
    });

    let neto = -linea.cantidad;

    if (p.estado === "cancelado" || p.estado === "caducado") {
      await tx.stockMovement.create({
        data: {
          productId: linea.productId,
          variation: linea.cantidad,
          reason: p.estado === "cancelado" ? "cancelacion_pedido" : "caducidad_pedido",
          orderId: id,
          userId: p.estado === "cancelado" ? userId : null,
          createdAt: clave,
        },
      });
      neto = 0;
    }

    variacion.set(linea.productId, (variacion.get(linea.productId) ?? 0) + neto);
  }

  return variacion;
}

// --- Facturas ----------------------------------------------------------------

type EventoFactura = {
  id: string;
  fecha: Date;
  entidad: EntidadFacturable;
} & (
  | { tipo: "retroactiva" }
  | { tipo: "rectificativa"; motivo: string; original: string }
  | { tipo: "reemision"; motivo: string }
);

const ORDEN_TIPO = { retroactiva: 0, rectificativa: 1, reemision: 2 } as const;

/** Facturas del plan completo, en orden cronológico y con su ID fijo. */
function eventosFactura(
  ctx: Contexto,
  plan: ReturnType<typeof planHistorico>,
): EventoFactura[] {
  type Borrador = {
    tipo: EventoFactura["tipo"];
    fecha: Date;
    entidad: EntidadFacturable;
    motivo?: string;
  };
  const borradores: Borrador[] = [];

  const anadir = (
    entidad: EntidadFacturable,
    cobro: Date,
    rectificacion: RectificacionSeed | undefined,
  ) => {
    borradores.push({ tipo: "retroactiva", fecha: cobro, entidad });

    if (rectificacion) {
      borradores.push({
        tipo: "rectificativa",
        fecha: sumarDias(cobro, rectificacion.dias),
        entidad,
        motivo: rectificacion.motivo,
      });

      if (rectificacion.reemision) {
        borradores.push({
          tipo: "reemision",
          fecha: sumarDias(cobro, rectificacion.reemision.dias),
          entidad,
          motivo: rectificacion.reemision.motivo,
        });
      }
    }
  };

  for (const r of plan.reparaciones) {
    if (r.cobro) {
      const cobro = fechaCobroReparacion(r, resolverFecha(r.fecha, ctx.ahora));
      anadir({ tipo: "solicitud", id: idReparacion(r.n) }, cobro, r.rectificacion);
    }
  }

  for (const p of plan.pedidos) {
    if (p.cobro) {
      const fechas = fechasPedido(p, resolverFecha(p.fecha, ctx.ahora), ctx.pendingOrderHours);
      anadir({ tipo: "pedido", id: idPedido(p.n) }, fechas.cobro as Date, p.rectificacion);
    }
  }

  borradores.sort(
    (a, b) =>
      a.fecha.getTime() - b.fecha.getTime() ||
      ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] ||
      a.entidad.id.localeCompare(b.entidad.id),
  );

  const retroactivas = new Map<string, string>();

  return borradores.map((borrador, i): EventoFactura => {
    const id = `seed-inv-${tres(i + 1)}`;
    const base = { id, fecha: borrador.fecha, entidad: borrador.entidad };

    switch (borrador.tipo) {
      case "retroactiva":
        retroactivas.set(borrador.entidad.id, id);
        return { ...base, tipo: "retroactiva" };
      case "rectificativa":
        return {
          ...base,
          tipo: "rectificativa",
          motivo: borrador.motivo as string,
          original: retroactivas.get(borrador.entidad.id) as string,
        };
      case "reemision":
        return { ...base, tipo: "reemision", motivo: borrador.motivo as string };
    }
  });
}

/** Emite la factura del evento si no existe ya. Devuelve si la ha creado. */
async function emitirFactura(ctx: Contexto, evento: EventoFactura): Promise<boolean> {
  const { tx } = ctx;

  if (await tx.invoice.findUnique({ where: { id: evento.id }, select: { id: true } })) {
    return false;
  }

  switch (evento.tipo) {
    case "retroactiva": {
      const factura = await emitirFacturaDeCobroEnTx(tx, evento.entidad, evento.fecha, {
        serie: "MIG",
        id: evento.id,
      });
      if (!factura) {
        throw new Error(`Seed: ${evento.entidad.id} no es facturable`);
      }
      return true;
    }
    case "rectificativa":
      await emitirRectificativaEnTx(
        tx,
        { invoiceId: evento.original, motivo: evento.motivo, staffId: ctx.encargadoId },
        evento.fecha,
        evento.id,
      );
      return true;
    case "reemision":
      await reemitirFacturaEnTx(
        tx,
        { entidad: evento.entidad, motivo: evento.motivo, staffId: ctx.encargadoId },
        evento.fecha,
        evento.id,
      );
      return true;
  }
}

// --- Entrada -----------------------------------------------------------------

export type ResumenHistorico = {
  reparaciones: number;
  pedidos: number;
  facturas: number;
};

/**
 * Crea lo que falte del histórico. Requiere la configuración, los usuarios y
 * los productos demo (`demo.ts`). Deja el stock de cada producto como estaba:
 * una reposición al principio del histórico cubre lo que este consume.
 */
export async function sembrarHistorico(tx: Tx, ahora: Date): Promise<ResumenHistorico> {
  const plan = planHistorico();

  const [config, usuarios, productos] = await Promise.all([
    tx.config.findUniqueOrThrow({ where: { id: 1 } }),
    tx.user.findMany({
      where: {
        email: {
          in: [...CLIENTES_HISTORICO, "encargado@demo.local", "admin@demo.local", "trabajador@demo.local"],
        },
      },
      select: { id: true, email: true },
    }),
    tx.product.findMany({
      where: { id: { in: plan.pedidos.flatMap((p) => p.lineas.map((l) => l.productId)) } },
      select: { id: true, price: true },
    }),
  ]);

  const porEmail = new Map(usuarios.map((u) => [u.email, u.id]));
  const usuario = (email: string) => {
    const id = porEmail.get(email);
    if (!id) throw new Error(`Seed: falta el usuario demo ${email}`);
    return id;
  };

  const ctx: Contexto = {
    tx,
    ahora,
    clientes: CLIENTES_HISTORICO.map(usuario),
    encargadoId: usuario("encargado@demo.local"),
    adminId: usuario("admin@demo.local"),
    trabajadorId: usuario("trabajador@demo.local"),
    diagnosticFeeCentimos: aCentimos(Number(config.diagnosticFee)),
    expirationDays: config.expirationDays,
    pendingOrderHours: config.pendingOrderHours,
    precios: new Map(productos.map((p) => [p.id, aCentimos(Number(p.price))])),
  };

  // Solo se factura lo creado en esta ejecución: una entidad que ya existía
  // conserva sus facturas (o su falta de ellas) tal como estaban.
  const creadas = new Set<string>();

  for (const r of plan.reparaciones) {
    if (await crearReparacion(ctx, r)) creadas.add(idReparacion(r.n));
  }
  const reparaciones = creadas.size;

  let pedidos = 0;
  const consumo = new Map<string, number>();
  for (const p of plan.pedidos) {
    const variacion = await crearPedido(ctx, p);
    if (!variacion) continue;

    creadas.add(idPedido(p.n));
    pedidos += 1;
    for (const [productId, neto] of variacion) {
      consumo.set(productId, (consumo.get(productId) ?? 0) + neto);
    }
  }

  // Reposición al inicio del histórico por lo que consumen los pedidos nuevos:
  // el stock final de cada producto es el mismo que antes del seed.
  const inicio = fechaHistorico(1, 1, 8, ahora);
  for (const [productId, neto] of consumo) {
    if (neto < 0) {
      await tx.stockMovement.create({
        data: {
          productId,
          variation: -neto,
          reason: "reposicion",
          userId: ctx.encargadoId,
          note: "Reposición del histórico demo",
          createdAt: inicio,
        },
      });
    }
  }

  let facturas = 0;
  for (const evento of eventosFactura(ctx, plan)) {
    if (creadas.has(evento.entidad.id) && (await emitirFactura(ctx, evento))) {
      facturas += 1;
    }
  }

  return { reparaciones, pedidos, facturas };
}
