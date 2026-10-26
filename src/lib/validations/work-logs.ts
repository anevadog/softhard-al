import { z } from "zod";

import { instanteDesdeInputMadrid } from "@/lib/work-logs";

/** Margen para el reloj del navegador al validar que algo no está en el futuro. */
const MARGEN_FUTURO_MS = 60_000;

const nota = z
  .string()
  .trim()
  .max(500, "La nota no puede superar los 500 caracteres");

export const entradaReparacionSchema = z.object({
  requestId: z.string().trim().min(1, "Reparación no válida"),
});

export const entradaGeneralSchema = z.object({
  nota: nota.min(1, "Indica en qué vas a trabajar"),
});

export const ORIGENES_SALIDA = ["inicio", "reparacion"] as const;

export const salidaSchema = z.object({
  workLogId: z.string().trim().min(1, "Fichaje no válido"),
  origen: z.enum(ORIGENES_SALIDA).catch("inicio"),
});

export const ORIGENES_STAFF = ["abiertos", "solicitud"] as const;

export const cierreStaffSchema = z.object({
  workLogId: z.string().trim().min(1, "Fichaje no válido"),
  origen: z.enum(ORIGENES_STAFF).catch("abiertos"),
});

const horaMadrid = (mensaje: string) =>
  z.string().transform((valor, ctx) => {
    const instante = instanteDesdeInputMadrid(valor);

    if (!instante) {
      ctx.addIssue({ code: "custom", message: mensaje });
      return z.NEVER;
    }

    return instante;
  });

/**
 * Corrección del staff. Las horas llegan de `datetime-local` en hora de Madrid
 * y se convierten a UTC. La salida vacía significa "sigue abierto"; si el
 * fichaje ya estaba cerrado, la capa de datos rechaza reabrirlo.
 */
export const correccionFichajeSchema = z
  .object({
    workLogId: z.string().trim().min(1, "Fichaje no válido"),
    origen: z.enum(ORIGENES_STAFF).catch("abiertos"),
    inicio: horaMadrid("Indica una hora de entrada válida"),
    fin: z
      .string()
      .optional()
      .default("")
      .transform((valor, ctx) => {
        if (!valor.trim()) {
          return null;
        }

        const instante = instanteDesdeInputMadrid(valor);

        if (!instante) {
          ctx.addIssue({ code: "custom", message: "Indica una hora de salida válida" });
          return z.NEVER;
        }

        return instante;
      }),
    nota: nota.optional().default(""),
  })
  .superRefine((datos, ctx) => {
    const limite = Date.now() + MARGEN_FUTURO_MS;

    if (datos.inicio.getTime() > limite) {
      ctx.addIssue({
        code: "custom",
        path: ["inicio"],
        message: "La entrada no puede estar en el futuro",
      });
    }

    if (datos.fin && datos.fin.getTime() > limite) {
      ctx.addIssue({
        code: "custom",
        path: ["fin"],
        message: "La salida no puede estar en el futuro",
      });
    }

    if (datos.fin && datos.fin < datos.inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["fin"],
        message: "La salida no puede ser anterior a la entrada",
      });
    }
  });

export type CorreccionFichajeInput = z.infer<typeof correccionFichajeSchema>;
