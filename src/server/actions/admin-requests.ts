"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import {
  calcularExpiracion,
  calcularImporteSiAcepta,
  validarPresupuesto,
} from "@/lib/quotes";
import { estadoSolicitudSchema, quoteSchema } from "@/lib/validations/quote";
import { requerirStaff } from "@/server/authorization";
import {
  cambiarEstadoSolicitud,
  crearPresupuesto,
  obtenerConfig,
} from "@/server/data/admin-requests";

export async function crearPresupuestoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requerirStaff();

  const parsed = quoteSchema.safeParse({
    requestId: formData.get("requestId"),
    budgetAmount: formData.get("budgetAmount"),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa el importe del presupuesto.",
      fieldErrors,
    };
  }

  const config = await obtenerConfig();

  if (!config) {
    return {
      status: "error",
      message: "No hay configuración de tarifas. Ejecuta el seed antes de crear presupuestos.",
    };
  }

  const errorImporte = validarPresupuesto(
    parsed.data.budgetAmount,
    config.diagnosticFee,
  );

  if (errorImporte) {
    return {
      status: "error",
      message: errorImporte,
      fieldErrors: { budgetAmount: [errorImporte] },
    };
  }

  const resultado = await crearPresupuesto({
    requestId: parsed.data.requestId,
    budgetAmount: parsed.data.budgetAmount,
    diagnosticFee: config.diagnosticFee,
    finalAmount: calcularImporteSiAcepta(
      parsed.data.budgetAmount,
      config.diagnosticFee,
    ),
    expiresAt: calcularExpiracion(new Date(), config.expirationDays),
  });

  if (!resultado.ok) {
    return {
      status: "error",
      message:
        resultado.motivo === "ya-existe"
          ? "Esta solicitud ya tiene un presupuesto."
          : "La solicitud ya no existe.",
    };
  }

  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`);
  revalidatePath("/app/solicitudes");

  redirect(`/admin/solicitudes/${parsed.data.requestId}?presupuesto=1`);
}

export async function cambiarEstadoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requerirStaff();

  const parsed = estadoSolicitudSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Estado no válido." };
  }

  const resultado = await cambiarEstadoSolicitud(
    parsed.data.requestId,
    parsed.data.status,
  );

  if (!resultado.ok) {
    const mensajes = {
      "no-existe": "La solicitud ya no existe.",
      "mismo-estado": "La solicitud ya está en ese estado.",
      "sin-presupuesto": "Crea un presupuesto antes de marcar aceptada o rechazada.",
    } as const;

    return { status: "error", message: mensajes[resultado.motivo] };
  }

  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`);
  revalidatePath("/app/solicitudes");

  redirect(`/admin/solicitudes/${parsed.data.requestId}?estado=1`);
}
