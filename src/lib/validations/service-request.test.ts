import { describe, expect, it } from "vitest";

import { serviceRequestSchema } from "@/lib/validations/service-request";

const VALID = {
  equipmentType: "portatil",
  brand: "Lenovo",
  model: "ThinkPad T14",
  issue: "No arranca después de la última actualización.",
  modality: "domicilio",
  timeSlot: "manana",
  address: "Calle de Ejemplo 12, 28001 Madrid",
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

  it("exige la dirección en recogida a domicilio y la recorta", () => {
    const sinDireccion = serviceRequestSchema.safeParse({ ...VALID, address: "   " });

    expect(sinDireccion.success).toBe(false);
    expect(sinDireccion.error?.issues[0]?.path).toEqual(["address"]);
    expect(sinDireccion.error?.issues[0]?.message).toBe("Indica la dirección de recogida");
    expect(serviceRequestSchema.safeParse({ ...VALID, address: "C/ 1" }).success).toBe(false);
    expect(serviceRequestSchema.parse({ ...VALID, address: "  Calle Mayor 1  " }).address).toBe(
      "Calle Mayor 1",
    );
  });

  it("limita la dirección a 200 caracteres", () => {
    expect(serviceRequestSchema.safeParse({ ...VALID, address: "a".repeat(201) }).success).toBe(
      false,
    );
  });

  it("en taller no pide dirección y descarta la que llegue", () => {
    const enTaller = {
      equipmentType: VALID.equipmentType,
      brand: VALID.brand,
      model: VALID.model,
      issue: VALID.issue,
      timeSlot: VALID.timeSlot,
      modality: "taller" as const,
    };

    expect(serviceRequestSchema.parse(enTaller).address).toBeNull();
    expect(
      serviceRequestSchema.parse({ ...enTaller, address: "Calle inyectada 9" }).address,
    ).toBeNull();
  });
});
