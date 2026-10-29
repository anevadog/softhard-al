import type { Prisma } from "@/generated/prisma/client";
import type { EmailEvent, EmailStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  emailPedidoConfirmado,
  emailPresupuestoListo,
  emailReparacionLista,
  type EmailRenderizado,
} from "@/lib/email-templates";
import { EQUIPMENT_LABELS } from "@/lib/service-requests";
import { aCentimos } from "@/lib/vat";
import { obtenerEmailProvider, urlApp, type EmailProvider } from "@/server/providers/email";

/**
 * Emails transaccionales con Transactional Outbox (5.2). Cada evento encola su
 * email en la misma transacción que lo produce: si se revierte, no hay email;
 * si se confirma, queda en `pending_emails`. Lo envía `procesarEmailsPendientes`
 * (el worker, `after()` o el reintento del panel). Entrega: al menos una vez.
 */

type Tx = Prisma.TransactionClient;

export const MAX_INTENTOS_EMAIL = 5;
/** Una fila `enviando` más antigua que esto se da por abandonada y se reclama. */
export const BLOQUEO_EMAIL_MS = 5 * 60 * 1000;

/**
 * Encola un email. `(event, entityId)` es único: repetir el evento (una
 * transición que se repite, un reintento) no encola un segundo email.
 */
async function encolarEnTx(
  tx: Tx,
  datos: { event: EmailEvent; entityId: string; to: string; email: EmailRenderizado },
): Promise<boolean> {
  const { count } = await tx.pendingEmail.createMany({
    data: [{ event: datos.event, entityId: datos.entityId, to: datos.to, ...datos.email }],
    skipDuplicates: true,
  });

  return count === 1;
}

const equipo = (solicitud: { equipmentType: keyof typeof EQUIPMENT_LABELS; brand: string; model: string }) =>
  `${EQUIPMENT_LABELS[solicitud.equipmentType].toLowerCase()} ${solicitud.brand} ${solicitud.model}`.trim();

/** "Pedido confirmado": al crear el pedido, en la transacción del checkout. */
export async function encolarPedidoConfirmadoEnTx(tx: Tx, orderId: string): Promise<boolean> {
  const pedido = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      total: true,
      expiresAt: true,
      user: { select: { name: true, email: true } },
      items: {
        orderBy: { id: "asc" },
        select: { quantity: true, price: true, product: { select: { name: true } } },
      },
    },
  });

  return encolarEnTx(tx, {
    event: "pedido_confirmado",
    entityId: orderId,
    to: pedido.user.email,
    email: emailPedidoConfirmado({
      nombre: pedido.user.name,
      pedidoId: orderId,
      lineas: pedido.items.map((item) => ({
        producto: item.product.name,
        cantidad: item.quantity,
        precioCentimos: aCentimos(Number(item.price)),
      })),
      totalCentimos: aCentimos(Number(pedido.total)),
      expiresAt: pedido.expiresAt,
      url: urlApp(`/app/pedidos/${orderId}`),
    }),
  });
}

/** "Presupuesto listo": al crear el presupuesto (la solicitud queda `diagnosticada`). */
export async function encolarPresupuestoListoEnTx(tx: Tx, requestId: string): Promise<boolean> {
  const solicitud = await tx.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      equipmentType: true,
      brand: true,
      model: true,
      client: { select: { name: true, email: true } },
      quote: { select: { budgetAmount: true, diagnosticFee: true, finalAmount: true, expiresAt: true } },
    },
  });

  if (!solicitud.quote) {
    return false;
  }

  const presupuestoCentimos = aCentimos(Number(solicitud.quote.budgetAmount));
  const diagnosticoCentimos = aCentimos(Number(solicitud.quote.diagnosticFee));

  return encolarEnTx(tx, {
    event: "presupuesto_listo",
    entityId: requestId,
    to: solicitud.client.email,
    email: emailPresupuestoListo({
      nombre: solicitud.client.name,
      equipo: equipo(solicitud),
      presupuestoCentimos,
      diagnosticoCentimos,
      finalCentimos:
        solicitud.quote.finalAmount === null
          ? presupuestoCentimos - diagnosticoCentimos
          : aCentimos(Number(solicitud.quote.finalAmount)),
      expiresAt: solicitud.quote.expiresAt,
      url: urlApp(`/app/solicitudes/${requestId}`),
    }),
  });
}

/** "Reparación lista": al pasar la solicitud a `lista`. */
export async function encolarReparacionListaEnTx(tx: Tx, requestId: string): Promise<boolean> {
  const solicitud = await tx.serviceRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: {
      equipmentType: true,
      brand: true,
      model: true,
      modality: true,
      paidAt: true,
      client: { select: { name: true, email: true } },
      quote: { select: { finalAmount: true } },
    },
  });

  return encolarEnTx(tx, {
    event: "reparacion_lista",
    entityId: requestId,
    to: solicitud.client.email,
    email: emailReparacionLista({
      nombre: solicitud.client.name,
      equipo: equipo(solicitud),
      modalidad: solicitud.modality,
      pendienteCentimos:
        solicitud.paidAt === null && solicitud.quote?.finalAmount
          ? aCentimos(Number(solicitud.quote.finalAmount))
          : null,
      url: urlApp(`/app/solicitudes/${requestId}`),
    }),
  });
}

// --- Worker ------------------------------------------------------------------

type FilaReclamada = {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attempts: number;
  lockedAt: Date;
};

/** Instante como `timestamp` UTC (las columnas son `timestamp` sin zona). */
const utc = (instante: Date) => instante.toISOString();

export type ResultadoProcesado = { enviados: number; reintentos: number; fallidos: number };

/**
 * Reclama un lote con `FOR UPDATE SKIP LOCKED` (`pendiente`, o `enviando`
 * abandonado hace más de 5 min) y lo marca `enviando` en una sola sentencia:
 * dos workers nunca toman la misma fila. Envía fuera de cualquier transacción
 * y marca cada fila condicionando por su `lockedAt`, para que un worker que
 * perdió la fila no pise el resultado de otro.
 */
export async function procesarEmailsPendientes(
  opciones: { provider?: EmailProvider; lote?: number; ahora?: Date } = {},
): Promise<ResultadoProcesado> {
  const provider = opciones.provider ?? obtenerEmailProvider();
  const lote = opciones.lote ?? 10;
  const ahora = opciones.ahora ?? new Date();
  const abandonadas = new Date(ahora.getTime() - BLOQUEO_EMAIL_MS);

  const filas = await prisma.$queryRaw<FilaReclamada[]>`
    UPDATE "pending_emails"
    SET "status" = 'enviando',
        "lockedAt" = (${utc(ahora)}::timestamptz AT TIME ZONE 'UTC'),
        "updatedAt" = (${utc(ahora)}::timestamptz AT TIME ZONE 'UTC')
    WHERE "id" IN (
      SELECT "id" FROM "pending_emails"
      WHERE "status" = 'pendiente'
         OR ("status" = 'enviando'
             AND "lockedAt" < (${utc(abandonadas)}::timestamptz AT TIME ZONE 'UTC'))
      ORDER BY "createdAt"
      LIMIT ${lote}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "to", "subject", "text", "html", "attempts", "lockedAt"`;

  const resultado: ResultadoProcesado = { enviados: 0, reintentos: 0, fallidos: 0 };

  for (const fila of filas) {
    const mia = { id: fila.id, status: "enviando" as const, lockedAt: fila.lockedAt };

    try {
      await provider.enviar({ to: fila.to, subject: fila.subject, text: fila.text, html: fila.html });

      await prisma.pendingEmail.updateMany({
        where: mia,
        data: { status: "enviado", sentAt: new Date(), lockedAt: null, lastError: null },
      });
      resultado.enviados += 1;
    } catch (error) {
      const intentos = fila.attempts + 1;
      const agotado = intentos >= MAX_INTENTOS_EMAIL;

      await prisma.pendingEmail.updateMany({
        where: mia,
        data: {
          status: agotado ? "fallido" : "pendiente",
          attempts: intentos,
          lockedAt: null,
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        },
      });

      if (agotado) {
        resultado.fallidos += 1;
      } else {
        resultado.reintentos += 1;
      }
    }
  }

  return resultado;
}

/** Para `after()`: un fallo aquí nunca rompe la petición; el worker lo recoge. */
export async function procesarEmailsPendientesSinFallar(): Promise<void> {
  try {
    await procesarEmailsPendientes();
  } catch (error) {
    console.error("Error procesando emails pendientes:", error);
  }
}

// --- Panel -------------------------------------------------------------------

/** "Reintentar" de un `fallido`: vuelve a `pendiente` con los intentos a 0. */
export async function reintentarEmailFallido(id: string): Promise<boolean> {
  const { count } = await prisma.pendingEmail.updateMany({
    where: { id, status: "fallido" },
    data: { status: "pendiente", attempts: 0, lockedAt: null },
  });

  return count === 1;
}

export const TAMANO_LISTADO_EMAILS = 100;

export async function listarEmailsAdmin(estado?: EmailStatus) {
  const [emails, grupos] = await Promise.all([
    prisma.pendingEmail.findMany({
      where: estado ? { status: estado } : {},
      orderBy: { createdAt: "desc" },
      take: TAMANO_LISTADO_EMAILS,
      select: {
        id: true,
        event: true,
        entityId: true,
        to: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    prisma.pendingEmail.groupBy({ by: ["status"], _count: true }),
  ]);

  const conteos: Record<EmailStatus, number> = { pendiente: 0, enviando: 0, enviado: 0, fallido: 0 };
  for (const grupo of grupos) {
    conteos[grupo.status] = grupo._count;
  }

  return { emails, conteos };
}
