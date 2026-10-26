"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import {
  asignacionSchema,
  devolucionSolicitudSchema,
  tomaSolicitudSchema,
} from "@/lib/validations/workshop";
import { requerirPersonalTaller, requerirStaff } from "@/server/authorization";
import {
  asignarSolicitudStaff,
  devolverSolicitudTrabajador,
  tomarSolicitudTrabajador,
  type MotivoAsignacion,
} from "@/server/data/assignments";

const MENSAJES: Record<MotivoAsignacion, string> = {
  "no-existe": "La reparación ya no existe.",
  conflicto: "La reparación ha cambiado. Recarga antes de volver a intentarlo.",
  "estado-final":
    "No se puede asignar ni devolver una reparación en estado final.",
  "trabajador-invalido": "Solo se puede asignar a usuarios con rol trabajador.",
  "mismo-asignado": "La reparación ya está asignada a ese trabajador.",
  "no-disponible": "La reparación ya no está disponible para tomar.",
  "no-autorizado": "No tienes permiso para esta acción.",
  "motivo-obligatorio": "Indica el motivo de la devolución.",
};

export async function asignarSolicitudAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = asignacionSchema.safeParse({
    requestId: formData.get("requestId"),
    assigneeId: formData.get("assigneeId"),
    assigneeEsperadoId: formData.get("assigneeEsperadoId") ?? "",
    motivo: formData.get("motivo") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa los datos de la asignación.",
      fieldErrors,
    };
  }

  const resultado = await asignarSolicitudStaff({
    requestId: parsed.data.requestId,
    assigneeId: parsed.data.assigneeId,
    assigneeEsperadoId: parsed.data.assigneeEsperadoId || null,
    actorId: staff.id,
    motivo: parsed.data.motivo,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`);
  revalidatePath("/trabajador");

  redirect(`/admin/solicitudes/${parsed.data.requestId}?asignacion=1`);
}

export async function tomarSolicitudAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const personal = await requerirPersonalTaller();

  const parsed = tomaSolicitudSchema.safeParse({
    requestId: formData.get("requestId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Solicitud no válida." };
  }

  const resultado = await tomarSolicitudTrabajador({
    requestId: parsed.data.requestId,
    actorId: personal.id,
    actorRol: personal.role,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidatePath("/trabajador");
  revalidatePath(`/trabajador/reparaciones/${parsed.data.requestId}`);
  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`);

  redirect(`/trabajador/reparaciones/${parsed.data.requestId}?tomada=1`);
}

export async function devolverSolicitudAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const personal = await requerirPersonalTaller();

  const parsed = devolucionSolicitudSchema.safeParse({
    requestId: formData.get("requestId"),
    motivo: formData.get("motivo") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa el motivo de la devolución.",
      fieldErrors,
    };
  }

  const resultado = await devolverSolicitudTrabajador({
    requestId: parsed.data.requestId,
    actorId: personal.id,
    actorRol: personal.role,
    motivo: parsed.data.motivo,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidatePath("/trabajador");
  revalidatePath(`/trabajador/reparaciones/${parsed.data.requestId}`);
  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`);

  redirect("/trabajador?devuelta=1");
}
