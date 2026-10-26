"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import {
  cierreStaffSchema,
  correccionFichajeSchema,
  entradaGeneralSchema,
  entradaReparacionSchema,
  salidaSchema,
} from "@/lib/validations/work-logs";
import { requerirPersonalTaller, requerirStaff } from "@/server/authorization";
import {
  cerrarFichajeStaff,
  corregirFichajeStaff,
  ficharEntradaGeneral,
  ficharEntradaReparacion,
  ficharSalida,
  type MotivoFichaje,
} from "@/server/data/work-logs";

const MENSAJES: Record<MotivoFichaje, string> = {
  "ya-abierto": "Ya tienes un fichaje abierto. Ciérralo antes de fichar de nuevo.",
  "reparacion-no-disponible":
    "Solo puedes fichar en reparaciones tuyas que estén en reparación.",
  "no-existe": "El fichaje ya no existe.",
  "no-abierto": "El fichaje ya estaba cerrado. Recarga para ver el estado actual.",
  "no-reabrir": "Un fichaje cerrado no se puede reabrir: indica la hora de salida.",
  "cierre-aparte": "Para cerrar un fichaje abierto usa el botón Cerrar.",
  "nota-obligatoria": "Las horas generales necesitan una nota.",
  "salida-anterior": "La salida no puede ser anterior a la entrada.",
  conflicto: "El fichaje ha cambiado. Recarga antes de volver a intentarlo.",
};

const SOLO_TRABAJADOR = "Solo los trabajadores fichan.";

function revalidarFichajes(requestId: string | null) {
  revalidatePath("/trabajador");
  revalidatePath("/trabajador/fichajes");
  revalidatePath("/admin/fichajes");

  if (requestId) {
    revalidatePath(`/trabajador/reparaciones/${requestId}`);
    revalidatePath(`/admin/solicitudes/${requestId}`);
  }
}

export async function ficharEntradaReparacionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const personal = await requerirPersonalTaller();

  if (personal.role !== "trabajador") {
    return { status: "error", message: SOLO_TRABAJADOR };
  }

  const parsed = entradaReparacionSchema.safeParse({
    requestId: formData.get("requestId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Reparación no válida." };
  }

  const resultado = await ficharEntradaReparacion({
    userId: personal.id,
    requestId: parsed.data.requestId,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidarFichajes(parsed.data.requestId);

  redirect(`/trabajador/reparaciones/${parsed.data.requestId}?fichaje=entrada`);
}

export async function ficharEntradaGeneralAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const personal = await requerirPersonalTaller();

  if (personal.role !== "trabajador") {
    return { status: "error", message: SOLO_TRABAJADOR };
  }

  const parsed = entradaGeneralSchema.safeParse({
    nota: formData.get("nota") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa la nota del fichaje.",
      fieldErrors,
    };
  }

  const resultado = await ficharEntradaGeneral({
    userId: personal.id,
    nota: parsed.data.nota,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidarFichajes(null);

  redirect("/trabajador?fichaje=entrada");
}

export async function ficharSalidaAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const personal = await requerirPersonalTaller();

  if (personal.role !== "trabajador") {
    return { status: "error", message: SOLO_TRABAJADOR };
  }

  const parsed = salidaSchema.safeParse({
    workLogId: formData.get("workLogId"),
    origen: formData.get("origen"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Fichaje no válido." };
  }

  const resultado = await ficharSalida({
    userId: personal.id,
    workLogId: parsed.data.workLogId,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidarFichajes(resultado.requestId);

  if (parsed.data.origen === "reparacion" && resultado.requestId) {
    redirect(`/trabajador/reparaciones/${resultado.requestId}?fichaje=salida`);
  }

  redirect("/trabajador?fichaje=salida");
}

export async function cerrarFichajeStaffAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = cierreStaffSchema.safeParse({
    workLogId: formData.get("workLogId"),
    origen: formData.get("origen"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Fichaje no válido." };
  }

  const resultado = await cerrarFichajeStaff({
    actorId: staff.id,
    workLogId: parsed.data.workLogId,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidarFichajes(resultado.requestId);

  if (parsed.data.origen === "solicitud" && resultado.requestId) {
    redirect(`/admin/solicitudes/${resultado.requestId}?fichaje=1`);
  }

  redirect("/admin/fichajes?cerrado=1");
}

export async function corregirFichajeStaffAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = correccionFichajeSchema.safeParse({
    workLogId: formData.get("workLogId"),
    origen: formData.get("origen"),
    inicio: formData.get("inicio") ?? "",
    fin: formData.get("fin") ?? "",
    nota: formData.get("nota") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa las horas de la corrección.",
      fieldErrors,
    };
  }

  const resultado = await corregirFichajeStaff({
    actorId: staff.id,
    workLogId: parsed.data.workLogId,
    inicio: parsed.data.inicio,
    fin: parsed.data.fin,
    nota: parsed.data.nota,
  });

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  revalidarFichajes(resultado.requestId);

  if (parsed.data.origen === "solicitud" && resultado.requestId) {
    redirect(`/admin/solicitudes/${resultado.requestId}?fichaje=1`);
  }

  redirect("/admin/fichajes?corregido=1");
}
