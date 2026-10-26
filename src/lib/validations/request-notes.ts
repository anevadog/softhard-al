import { z } from "zod";

import { LONGITUD_MAXIMA_NOTA, TIPOS_NOTA } from "@/lib/request-notes";

export const crearNotaSchema = z.object({
  requestId: z.string().trim().min(1, "Reparación no válida"),
  tipo: z.enum(TIPOS_NOTA, { error: "Tipo de nota no válido" }),
  texto: z
    .string()
    .trim()
    .min(1, "Escribe la nota")
    .max(LONGITUD_MAXIMA_NOTA, `La nota no puede superar los ${LONGITUD_MAXIMA_NOTA} caracteres`),
});

export type CrearNotaInput = z.infer<typeof crearNotaSchema>;

export const atenderNotaSchema = z.object({
  noteId: z.string().trim().min(1, "Nota no válida"),
});
