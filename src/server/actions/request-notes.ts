"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import { atenderNotaSchema, crearNotaSchema } from "@/lib/validations/request-notes";
import { requerirPersonalTaller, requerirStaff } from "@/server/authorization";
import {
  crearNotaStaff,
  crearNotaTrabajador,
  marcarNotaAtendida,
  type MotivoNota,
} from "@/server/data/request-notes";

const MENSAJES: Record<MotivoNota, string> = {
  "no-disponible":
    "Ya no puedes dejar notas en esta reparación: no es tuya o está cerrada.",
  "no-existe": "La reparación ya no existe.",
  "nota-no-existe": "La nota ya no existe.",
  "ya-atendida": "La falta de repuesto ya estaba atendida.",
  "no-es-falta": "Solo se marcan como atendidas las faltas de repuesto.",
};

function revalidarNotas(requestId: string) {
  revalidatePath("/trabajador");
  revalidatePath(`/trabajador/reparaciones/${requestId}`);
  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${requestId}`);
}

/**
 * Una sola acción para trabajador y staff: el rol, revalidado en BD, decide
 * qué reglas aplican y a qué detalle se vuelve.
 */
export async function crearNotaAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const personal = await requerirPersonalTaller();

  const parsed = crearNotaSchema.safeParse({
    requestId: formData.get("requestId"),
    tipo: formData.get("tipo"),
    texto: formData.get("texto") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return { status: "error", message: "Revisa la nota.", fieldErrors };
  }

  const resultado =
    personal.role === "trabajador"
      ? await crearNotaTrabajador({ userId: personal.id, ...parsed.data })
      : await crearNotaStaff({ actorId: personal.id, ...parsed.data });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidarNotas(resultado.requestId);

  if (personal.role === "trabajador") {
    redirect(`/trabajador/reparaciones/${resultado.requestId}?nota=1`);
  }

  redirect(`/admin/solicitudes/${resultado.requestId}?nota=1`);
}

export async function marcarNotaAtendidaAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = atenderNotaSchema.safeParse({ noteId: formData.get("noteId") });

  if (!parsed.success) {
    return { status: "error", message: "Nota no válida." };
  }

  const resultado = await marcarNotaAtendida({
    actorId: staff.id,
    noteId: parsed.data.noteId,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidarNotas(resultado.requestId);

  redirect(`/admin/solicitudes/${resultado.requestId}?nota=atendida`);
}
