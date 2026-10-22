import { describe, expect, it } from "vitest";

import { serviceRequestSchema } from "@/lib/validations/service-request";

const VALID = {
  equipmentType: "portatil",
  brand: "Lenovo",
  model: "ThinkPad T14",
  issue: "No arranca después de la última actualización.",
  modality: "domicilio",
  timeSlot: "manana",
} as const;

describe("serviceRequestSchema", () => {
  it("acepta una solicitud válida y recorta espacios", () => {
    const result = serviceRequestSchema.parse({ ...VALID, brand: "  Lenovo  ", model: " T14 " });

    expect(result.brand).toBe("Lenovo");
    expect(result.model).toBe("T14");
  });

  it("rechaza el tipo 'otro' porque el formulario no lo ofrece", () => {
    expect(serviceRequestSchema.safeParse({ ...VALID, equipmentType: "otro" }).success).toBe(false);
  });

  it("rechaza una marca vacía", () => {
    expect(serviceRequestSchema.safeParse({ ...VALID, brand: "   " }).success).toBe(false);
  });

  it("rechaza un modelo vacío", () => {
    expect(serviceRequestSchema.safeParse({ ...VALID, model: "" }).success).toBe(false);
  });

  it("rechaza un problema demasiado corto", () => {
    expect(serviceRequestSchema.safeParse({ ...VALID, issue: "No va" }).success).toBe(false);
  });

  it("rechaza un problema de más de 2000 caracteres", () => {
    const issue = "a".repeat(2001);

    expect(serviceRequestSchema.safeParse({ ...VALID, issue }).success).toBe(false);
  });

  it("rechaza una modalidad no válida", () => {
    expect(serviceRequestSchema.safeParse({ ...VALID, modality: "mensajero" }).success).toBe(false);
  });

  it("rechaza una franja horaria no válida", () => {
    expect(serviceRequestSchema.safeParse({ ...VALID, timeSlot: "noche" }).success).toBe(false);
  });

  it("descarta campos que el formulario no controla (clientId, status, expiresAt)", () => {
    const result = serviceRequestSchema.parse({
      ...VALID,
      clientId: "usuario-ajeno",
      status: "entregada",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });

    expect(result).not.toHaveProperty("clientId");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("expiresAt");
  });

  it("rechaza un formulario sin campos", () => {
    expect(serviceRequestSchema.safeParse({}).success).toBe(false);
  });
});
