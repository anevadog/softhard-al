import { prisma } from "@/lib/db";
import {
  precioDesdeCentimos,
  prepararPedido,
  type MotivoPedidoInvalido,
  type PedidoDetalle,
  type PedidoResumen,
} from "@/lib/orders";

export type ResultadoCrearPedido =
  | { ok: true; pedidoId: string }
  | {
      ok: false;
      motivo: MotivoPedidoInvalido;
      productIds?: string[];
    };

class ConflictoStock extends Error {
  constructor(public readonly productIds: string[]) {
    super("Stock insuficiente");
  }
}

function esConflictoUnico(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function buscarPorIdempotencia(
  userId: string,
  idempotencyKey: string,
): Promise<{ id: string } | null> {
  return prisma.order.findFirst({
    where: { userId, idempotencyKey },
    select: { id: true },
  });
}

/**
 * Crea el pedido y descuenta el stock en una sola transacción.
 *
 * El stock se actualiza con un `updateMany` condicional por producto, ordenado
 * por id para reducir bloqueos cruzados. Si dos compras compiten por la última
 * unidad, PostgreSQL reevalúa la condición tras el bloqueo y solo una actualiza;
 * la otra lanza `ConflictoStock` y revierte toda la transacción.
 */
export async function crearPedidoCliente(
  userId: string,
  items: readonly { productId: string; quantity: number }[],
  idempotencyKey: string,
): Promise<ResultadoCrearPedido> {
  const yaCreado = await buscarPorIdempotencia(userId, idempotencyKey);

  if (yaCreado) {
    return { ok: true, pedidoId: yaCreado.id };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const productos = await tx.product.findMany({
        where: { id: { in: items.map((item) => item.productId) } },
        select: { id: true, price: true, stock: true, active: true },
      });

      const preparado = prepararPedido(
        items,
        productos.map((producto) => ({
          id: producto.id,
          price: Number(producto.price),
          stock: producto.stock,
          active: producto.active,
        })),
      );

      if (!preparado.ok) {
        return preparado;
      }

      const lineasOrdenadas = [...preparado.lineas].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );

      for (const linea of lineasOrdenadas) {
        const actualizado = await tx.product.updateMany({
          where: {
            id: linea.productId,
            active: true,
            stock: { gte: linea.quantity },
          },
          data: { stock: { decrement: linea.quantity } },
        });

        if (actualizado.count === 0) {
          throw new ConflictoStock([linea.productId]);
        }
      }

      const pedido = await tx.order.create({
        data: {
          userId,
          total: precioDesdeCentimos(preparado.totalCentimos),
          status: "pendiente",
          idempotencyKey,
          items: {
            create: preparado.lineas.map((linea) => ({
              productId: linea.productId,
              quantity: linea.quantity,
              price: precioDesdeCentimos(linea.priceCentimos),
            })),
          },
        },
        select: { id: true },
      });

      return { ok: true, pedidoId: pedido.id };
    });
  } catch (error) {
    if (error instanceof ConflictoStock) {
      // El primer intento con la misma clave puede haber ganado la carrera.
      const yaCreadoTrasConflicto = await buscarPorIdempotencia(
        userId,
        idempotencyKey,
      );

      if (yaCreadoTrasConflicto) {
        return { ok: true, pedidoId: yaCreadoTrasConflicto.id };
      }

      return {
        ok: false,
        motivo: "stock-insuficiente",
        productIds: error.productIds,
      };
    }

    if (esConflictoUnico(error)) {
      const yaCreadoTrasConflicto = await buscarPorIdempotencia(
        userId,
        idempotencyKey,
      );

      if (yaCreadoTrasConflicto) {
        return { ok: true, pedidoId: yaCreadoTrasConflicto.id };
      }
    }

    throw error;
  }
}

export async function listarPedidosCliente(
  userId: string,
): Promise<PedidoResumen[]> {
  const pedidos = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      total: true,
      status: true,
      createdAt: true,
      items: { select: { quantity: true } },
    },
  });

  return pedidos.map((pedido) => ({
    id: pedido.id,
    total: Number(pedido.total),
    status: pedido.status,
    createdAt: pedido.createdAt,
    unidades: pedido.items.reduce((total, item) => total + item.quantity, 0),
    lineas: pedido.items.length,
  }));
}

/**
 * Detalle filtrado por propietario. Devolver `null` para un pedido ajeno evita
 * revelar si el identificador existe.
 */
export async function obtenerPedidoCliente(
  orderId: string,
  userId: string,
): Promise<PedidoDetalle | null> {
  const pedido = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      total: true,
      status: true,
      createdAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          quantity: true,
          price: true,
          product: { select: { name: true, imageUrl: true } },
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
    items: pedido.items.map((item) => {
      const priceCentimos = Math.round(Number(item.price) * 100);

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        imageUrl: item.product.imageUrl,
        quantity: item.quantity,
        price: priceCentimos / 100,
        subtotal: (priceCentimos * item.quantity) / 100,
      };
    }),
  };
}
