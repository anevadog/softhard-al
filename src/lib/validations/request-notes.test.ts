import { describe, expect, it } from "vitest";

import { atenderNotaSchema, crearNotaSchema } from "@/lib/validations/request-notes";

const VALIDA = { requestId: "req-1", tipo: "normal", texto: "Revisado el ventilador" };

describe("crearNotaSchema", () => {
  it("acepta los dos tipos y recorta el texto", () => {
    expect(crearNotaSchema.parse({ ...VALIDA, texto: "  Hola  " }).texto).toBe("Hola");
    expect(crearNotaSchema.parse({ ...VALIDA, tipo: "falta_repuesto" }).tipo).toBe(
      "falta_repuesto",
    );
  });

  it("rechaza texto vacío, demasiado largo o tipos inventados", () => {
    expect(crearNotaSchema.safeParse({ ...VALIDA, texto: "   " }).success).toBe(false);
    expect(crearNotaSchema.safeParse({ ...VALIDA, texto: "a".repeat(1001) }).success).toBe(false);
    expect(crearNotaSchema.safeParse({ ...VALIDA, tipo: "urgente" }).success).toBe(false);
  });

  it("exige la reparación", () => {
    expect(crearNotaSchema.safeParse({ ...VALIDA, requestId: "" }).success).toBe(false);
  });
});

describe("atenderNotaSchema", () => {
  it("exige el identificador de la nota", () => {
    expect(atenderNotaSchema.safeParse({ noteId: "" }).success).toBe(false);
    expect(atenderNotaSchema.parse({ noteId: " n-1 " }).noteId).toBe("n-1");
  });
});
