import { PrismaPg } from "@prisma/adapter-pg";
import { vi } from "vitest";

import type { Prisma } from "@/generated/prisma/client";
import { PrismaClient } from "@/generated/prisma/client";
import type { EquipmentType, Role, ServiceStatus } from "@/generated/prisma/enums";
import { asegurarBdDeTest } from "@/test/integration/test-database";

export type Tx = Prisma.TransactionClient;

let base: PrismaClient | null = null;

function clienteBase(): PrismaClient {
  asegurarBdDeTest(process.env.DATABASE_URL);
  base ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  return base;
}

export async function cerrarConexion(): Promise<void> {
  await base?.$disconnect();
  base = null;
}

class Rollback extends Error {}

/**
 * Ejecuta `fn` dentro de una transacción que siempre se revierte. La capa de
 * datos toma el cliente de `globalThis.prisma` al importarse, así que antes de
 * `fn` se reinician los módulos: dentro de `fn`, importa los módulos a probar
 * con `await import(...)`. Las llamadas a `$transaction` de la capa de datos
 * reutilizan la misma transacción (tanto la forma callback como la de array).
 */
export async function enTransaccion(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await clienteBase().$transaction(
      async (tx) => {
        const cliente: unknown = new Proxy(tx, {
          get(objetivo, clave) {
            if (clave === "$transaction") {
              return async (arg: unknown) => {
                if (Array.isArray(arg)) {
                  const resultados: unknown[] = [];
                  for (const operacion of arg) resultados.push(await operacion);
                  return resultados;
                }

                return (arg as (c: unknown) => unknown)(cliente);
              };
            }

            return Reflect.get(objetivo, clave);
          },
        });

        (globalThis as unknown as { prisma?: unknown }).prisma = cliente;
        vi.resetModules();

        await fn(tx);

        throw new Rollback();
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  } finally {
    delete (globalThis as unknown as { prisma?: unknown }).prisma;
  }
}

/**
 * Para operaciones que deben fallar en PostgreSQL (índice único, check): un
 * error aborta la transacción, así que se aísla en un savepoint.
 */
export async function conSavepoint<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  await tx.$executeRawUnsafe("SAVEPOINT test_integracion");

  try {
    return await fn();
  } finally {
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT test_integracion");
  }
}

let secuencia = 0;

export async function crearUsuario(tx: Tx, role: Role, name = `Test ${role}`) {
  secuencia += 1;

  return tx.user.create({
    data: {
      email: `int-${role}-${secuencia}-${Date.now()}@test.local`,
      name,
      role,
      passwordHash: "sin-login",
      phone: "600000000",
    },
  });
}

export async function crearSolicitud(
  tx: Tx,
  datos: {
    clientId: string;
    status?: ServiceStatus;
    assigneeId?: string | null;
    lastActivityAt?: Date;
    equipmentType?: EquipmentType;
    modality?: "domicilio" | "taller";
    address?: string | null;
  },
) {
  return tx.serviceRequest.create({
    data: {
      clientId: datos.clientId,
      status: datos.status ?? "pendiente",
      assigneeId: datos.assigneeId ?? null,
      equipmentType: datos.equipmentType ?? "portatil",
      brand: "Test",
      model: datos.status ?? "pendiente",
      issue: "Avería de prueba de integración",
      modality: datos.modality ?? "taller",
      address: datos.address ?? null,
      ...(datos.lastActivityAt ? { lastActivityAt: datos.lastActivityAt } : {}),
    },
  });
}

export async function crearProducto(
  tx: Tx,
  datos: { stock: number; price?: string; active?: boolean; name?: string },
) {
  secuencia += 1;

  const producto = await tx.product.create({
    data: {
      name: datos.name ?? `Producto int ${secuencia}`,
      description: "Producto de prueba de integración",
      price: datos.price ?? "10.00",
      stock: datos.stock,
      category: "accesorios",
      active: datos.active ?? true,
    },
  });

  if (datos.stock > 0) {
    await tx.stockMovement.create({
      data: { productId: producto.id, variation: datos.stock, reason: "stock_inicial" },
    });
  }

  return producto;
}

/**
 * Invariante del libro: `Product.stock` es la suma de las variaciones de sus
 * movimientos. Devuelve ambos valores para compararlos en el test.
 */
export async function libroStock(
  tx: Tx,
  productId: string,
): Promise<{ stock: number; suma: number }> {
  const [producto, agregado] = await Promise.all([
    tx.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true } }),
    tx.stockMovement.aggregate({ where: { productId }, _sum: { variation: true } }),
  ]);

  return { stock: producto.stock, suma: agregado._sum.variation ?? 0 };
}

/**
 * Presupuesto ya decidido (o pendiente) para una solicitud. `finalAmount` sigue
 * la regla de negocio: presupuesto − X si se acepta, X si se rechaza.
 */
export async function crearPresupuesto(
  tx: Tx,
  datos: {
    requestId: string;
    status: "pendiente" | "aceptado" | "rechazado" | "expirado";
    budgetAmount?: string;
    diagnosticFee?: string;
  },
) {
  const budget = datos.budgetAmount ?? "120.00";
  const fee = datos.diagnosticFee ?? "30.00";
  const finalAmount =
    datos.status === "aceptado"
      ? (Number(budget) - Number(fee)).toFixed(2)
      : datos.status === "rechazado"
        ? fee
        : null;

  return tx.quote.create({
    data: {
      requestId: datos.requestId,
      budgetAmount: budget,
      diagnosticFee: fee,
      finalAmount,
      status: datos.status,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      decidedAt: datos.status === "pendiente" ? null : new Date(),
    },
  });
}
