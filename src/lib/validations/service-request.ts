import { z } from "zod";

/**
 * Tipos de equipo que se ofrecen en el formulario. El enum de base de datos
 * admite `otro`, pero no se expone en Fase 1.
 */
export const EQUIPMENT_TYPES = ["ordenador", "portatil", "impresora"] as const;

export const MODALITIES = ["domicilio", "taller"] as const;

export const TIME_SLOTS = ["manana", "tarde", "indiferente"] as const;

/** Límite alineado con el `@db.Text` del esquema y con la UX del textarea. */
const MAX_ISSUE_LENGTH = 2000;
const MIN_ISSUE_LENGTH = 10;

export const MIN_ADDRESS_LENGTH = 5;
export const MAX_ADDRESS_LENGTH = 200;

export const serviceRequestSchema = z
  .object({
    equipmentType: z.enum(EQUIPMENT_TYPES, {
      error: "Selecciona el tipo de equipo",
    }),
    brand: z
      .string()
      .trim()
      .min(1, "Indica la marca del equipo")
      .max(60, "La marca no puede superar los 60 caracteres"),
    model: z
      .string()
      .trim()
      .min(1, "Indica el modelo del equipo")
      .max(60, "El modelo no puede superar los 60 caracteres"),
    issue: z
      .string()
      .trim()
      .min(MIN_ISSUE_LENGTH, `Describe el problema con al menos ${MIN_ISSUE_LENGTH} caracteres`)
      .max(MAX_ISSUE_LENGTH, `El problema no puede superar los ${MAX_ISSUE_LENGTH} caracteres`),
    modality: z.enum(MODALITIES, {
      error: "Selecciona cómo nos haces llegar el equipo",
    }),
    timeSlot: z.enum(TIME_SLOTS, {
      error: "Selecciona una franja horaria",
    }),
    address: z
      .string()
      .trim()
      .max(MAX_ADDRESS_LENGTH, `La dirección no puede superar los ${MAX_ADDRESS_LENGTH} caracteres`)
      .optional()
      .default(""),
  })
  // La dirección solo tiene sentido en recogida a domicilio: ahí es
  // obligatoria y en taller se descarta aunque llegue en la petición.
  .superRefine((datos, ctx) => {
    if (datos.modality === "domicilio" && datos.address.length < MIN_ADDRESS_LENGTH) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: datos.address
          ? `La dirección debe tener al menos ${MIN_ADDRESS_LENGTH} caracteres`
          : "Indica la dirección de recogida",
      });
    }
  })
  .transform((datos) => ({
    ...datos,
    address: datos.modality === "domicilio" ? datos.address : null,
  }));

export type ServiceRequestInput = z.infer<typeof serviceRequestSchema>;
