import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { asegurarBdDeTest } from "@/test/integration/test-database";

/**
 * Datos que crea un test sin rollback. Todo lleva el prefijo de la ejecución,
 * que es lo único que se usa para limpiar.
 */
export type ContextoSinRollback = {
  db: PrismaClient;
  prefijo: string;
  crearCliente: () => Promise<{ id: string }>;
  crearUsuario: (role: Role) => Promise<{ id: string }>;
  crearProducto: (stock: number) => Promise<{ id: string }>;
};

/**
 * Para los pocos tests que necesitan concurrencia real (`enTransaccion` mete
 * todo en una sola transacción y no permite paralelismo). La capa de datos usa
 * un `PrismaClient` propio con su pool, así que sus `$transaction` son
 * transacciones reales en conexiones distintas.
 *
 * No hay rollback: en `finally` se borra, en orden de claves foráneas, solo lo
 * que lleva el prefijo de esta ejecución, y se comprueba que no queda nada.
 * Nunca hay `TRUNCATE` ni borrados fuera del prefijo. Dentro de `fn`, importa
 * los módulos a probar con `await import(...)`, igual que con `enTransaccion`.
 */
export async function sinRollback(
  fn: (contexto: ContextoSinRollback) => Promise<void>,
): Promise<void> {
  asegurarBdDeTest(process.env.DATABASE_URL);

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const prefijo = `conc-${randomUUID().slice(0, 8)}`;
  let secuencia = 0;

  (globalThis as unknown as { prisma?: unknown }).prisma = db;
  vi.resetModules();

  const crearUsuario = async (role: Role) => {
    secuencia += 1;

    return db.user.create({
      data: {
        email: `${prefijo}-${secuencia}@test.local`,
        name: `${prefijo} ${role} ${secuencia}`,
        role,
        passwordHash: "sin-login",
      },
      select: { id: true },
    });
  };

  const contexto: ContextoSinRollback = {
    db,
    prefijo,
    crearCliente: () => crearUsuario("cliente"),
    crearUsuario,
    crearProducto: async (stock) => {
      secuencia += 1;

      return db.$transaction(async (tx) => {
        const producto = await tx.product.create({
          data: {
            name: `${prefijo} producto ${secuencia}`,
            description: "Producto de prueba de concurrencia",
            price: "10.00",
            stock,
            category: "accesorios",
          },
          select: { id: true },
        });

        if (stock > 0) {
          await tx.stockMovement.create({
            data: { productId: producto.id, variation: stock, reason: "stock_inicial" },
          });
        }

        return producto;
      });
    },
  };

  try {
    await fn(contexto);
  } finally {
    delete (globalThis as unknown as { prisma?: unknown }).prisma;

    try {
      await limpiar(db, prefijo);
    } finally {
      await db.$disconnect();
    }
  }
}

async function limpiar(db: PrismaClient, prefijo: string): Promise<void> {
  const usuarios = { email: { startsWith: `${prefijo}-` } };
  const productos = { name: { startsWith: `${prefijo} ` } };

  const emails = { to: { startsWith: `${prefijo}-` } };

  await db.pendingEmail.deleteMany({ where: emails });
  // Antes que pedidos, solicitudes y usuarios: sus FK son Restrict.
  await db.paymentSession.deleteMany({ where: { customer: usuarios } });
  await db.stockMovement.deleteMany({ where: { product: productos } });
  // Las facturas son inmutables: el trigger solo deja borrarlas en una
  // transacción que lo pida con SET LOCAL (y solo esta limpieza lo hace). Se
  // borran primero las que ninguna otra referencia (rectificativas,
  // re-emisiones) hasta vaciar la cadena.
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL softhard.permitir_borrado_facturas = 'on'");

    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      const borradas = await tx.invoice.deleteMany({
        where: { customer: usuarios, rectifications: { none: {} }, replacements: { none: {} } },
      });

      if (borradas.count === 0) {
        break;
      }
    }
  });
  // Solicitudes antes que usuarios: `paidById` es Restrict. Presupuestos e
  // historiales se borran en cascada con la solicitud.
  await db.serviceRequest.deleteMany({ where: { client: usuarios } });
  await db.orderItem.deleteMany({ where: { order: { user: usuarios } } });
  await db.order.deleteMany({ where: { user: usuarios } });
  await db.product.deleteMany({ where: productos });
  await db.user.deleteMany({ where: usuarios });

  const residuos =
    (await db.user.count({ where: usuarios })) +
    (await db.product.count({ where: productos })) +
    (await db.order.count({ where: { user: usuarios } })) +
    (await db.serviceRequest.count({ where: { client: usuarios } })) +
    (await db.invoice.count({ where: { customer: usuarios } })) +
    (await db.pendingEmail.count({ where: emails })) +
    (await db.paymentSession.count({ where: { customer: usuarios } }));

  if (residuos > 0) {
    throw new Error(`sinRollback: quedan ${residuos} filas con el prefijo ${prefijo}.`);
  }
}
