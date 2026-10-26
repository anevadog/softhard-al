import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  ORDER_STATUSES,
  puedeCambiarEstadoPedido,
  type PedidoAdminDetalle,
  type PedidoAdminResumen,
} from "@/lib/orders";

export async function listarPedidosAdmin(
  estado?: OrderStatus,
): Promise<PedidoAdminResumen[]> {
  const pedidos = await prisma.order.findMany({
    where: estado ? { status: estado } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      total: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  return pedidos.map((pedido) => ({
    id: pedido.id,
    total: Number(pedido.total),
    status: pedido.status,
    createdAt: pedido.createdAt,
    client: pedido.user,
  }));
}

export async function contarPedidosPorEstado(): Promise<
  Record<OrderStatus, number>
> {
  const grupos = await prisma.order.groupBy({
    by: ["status"],
    _count: true,
  });

  const conteo = Object.fromEntries(
    ORDER_STATUSES.map((estado) => [estado, 0]),
  ) as Record<OrderStatus, number>;

  for (const grupo of grupos) {
    conteo[grupo.status] = grupo._count;
  }

  return conteo;
}

export async function obtenerPedidoAdmin(
  id: string,
): Promise<PedidoAdminDetalle | null> {
  const pedido = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      total: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true, phone: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          quantity: true,
          price: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  if (!pedido) {
    return null;
  }

  return {
    id: pedido.id,
    total: Number(pedido.total),
    status: pedido.status,
    createdAt: pedido.createdAt,
    client: pedido.user,
    items: pedido.items.map((item) => {
      const price = Math.round(Number(item.price) * 100) / 100;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        price,
        subtotal: Math.round(price * 100 * item.quantity) / 100,
      };
    }),
  };
}

export type DatosCambioEstadoPedido = {
  orderId: string;
  estadoEsperado: OrderStatus;
  estadoNuevo: OrderStatus;
  userId: string;
  motivo: string | null;
};

export type ResultadoCambioEstadoPedido =
  | { ok: true; productIds: string[] }
  | { ok: false; motivo: "transicion-invalida" | "conflicto" };

/**
 * Cambia el estado solo si sigue en el estado que vio la persona. La
 * actualización condicional es la que decide la carrera; el perdedor no toca
 * nada.
 *
 * En una cancelación, las líneas se leen DENTRO de la transacción y DESPUÉS de
 * que la actualización haya modificado una fila. Así una segunda cancelación no
 * repone stock con datos antiguos.
 */
export async function cambiarEstadoPedidoAdmin(
  datos: DatosCambioEstadoPedido,
): Promise<ResultadoCambioEstadoPedido> {
  if (!puedeCambiarEstadoPedido(datos.estadoEsperado, datos.estadoNuevo)) {
    return { ok: false, motivo: "transicion-invalida" };
  }

  if (datos.estadoNuevo !== "cancelado") {
    const actualizado = await prisma.order.updateMany({
      where: { id: datos.orderId, status: datos.estadoEsperado },
      data: { status: datos.estadoNuevo },
    });

    return actualizado.count > 0
      ? { ok: true, productIds: [] }
      : { ok: false, motivo: "conflicto" };
  }

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.order.updateMany({
      where: { id: datos.orderId, status: datos.estadoEsperado },
      data: { status: "cancelado" },
    });

    if (actualizado.count === 0) {
      return { ok: false as const, motivo: "conflicto" as const };
    }

    const lineas = await tx.orderItem.findMany({
      where: { orderId: datos.orderId },
      select: { productId: true, quantity: true },
    });

    for (const linea of lineas) {
      // Sin filtro `active`: un producto archivado también recupera su stock.
      await tx.product.update({
        where: { id: linea.productId },
        data: { stock: { increment: linea.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId: linea.productId,
          variation: linea.quantity,
          reason: "cancelacion_pedido",
          orderId: datos.orderId,
          userId: datos.userId,
          note: datos.motivo,
        },
      });
    }

    return {
      ok: true as const,
      productIds: lineas.map((linea) => linea.productId),
    };
  });
}
