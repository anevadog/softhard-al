import { describe, expect, it } from "vitest";

import type { EmailProvider, EmailSaliente } from "@/server/providers/email";
import { sinRollback } from "@/test/integration/sin-rollback";

/**
 * Concurrencia real del worker de emails (5.2): dos workers simultáneos, en
 * conexiones distintas, nunca envían la misma fila (`FOR UPDATE SKIP LOCKED`).
 */

const TOTAL = 12;

/** Proveedor lento: obliga a que los dos workers se solapen. */
function proveedorLento(enviados: EmailSaliente[]): EmailProvider {
  return {
    nombre: "lento",
    enviar: async (email) => {
      await new Promise((resolver) => setTimeout(resolver, 20));
      enviados.push(email);
    },
  };
}

describe("worker de emails en concurrencia", () => {
  it("dos workers a la vez no envían la misma fila", () =>
    sinRollback(async ({ db, prefijo }) => {
      const { procesarEmailsPendientes } = await import("@/server/data/emails");

      await db.pendingEmail.createMany({
        data: Array.from({ length: TOTAL }, (_, i) => ({
          event: "pedido_confirmado" as const,
          entityId: `${prefijo}-pedido-${i}`,
          to: `${prefijo}-${i}@test.local`,
          subject: `Email ${i}`,
          text: "Texto",
          html: "<p>HTML</p>",
        })),
      });

      const enviadosA: EmailSaliente[] = [];
      const enviadosB: EmailSaliente[] = [];

      await Promise.all([
        procesarEmailsPendientes({ provider: proveedorLento(enviadosA), lote: TOTAL }),
        procesarEmailsPendientes({ provider: proveedorLento(enviadosB), lote: TOTAL }),
      ]);
      // Lo que quede (si un worker reclamó todo antes que el otro), en una pasada más.
      await procesarEmailsPendientes({ provider: proveedorLento(enviadosA), lote: TOTAL });

      const destinatarios = [...enviadosA, ...enviadosB].map((email) => email.to);
      expect(destinatarios).toHaveLength(TOTAL);
      expect(new Set(destinatarios).size).toBe(TOTAL);

      const estados = await db.pendingEmail.groupBy({
        by: ["status"],
        where: { to: { startsWith: `${prefijo}-` } },
        _count: true,
      });
      expect(estados).toEqual([{ status: "enviado", _count: TOTAL }]);
    }));
});
