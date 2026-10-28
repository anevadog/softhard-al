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
