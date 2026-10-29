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
import { quoteSchema } from "@/lib/validations/quote";
import { cambioEstadoSchema } from "@/lib/validations/workshop";
import { requerirPersonalTaller, requerirStaff } from "@/server/authorization";
import {
  crearPresupuesto,
  obtenerConfig,
} from "@/server/data/admin-requests";
import {
  cambiarEstadoSolicitud,
  type MotivoCambioEstado,
} from "@/server/data/service-status";

export async function crearPresupuestoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

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
    userId: staff.id,
  });

  if (!resultado.ok) {
    const mensajes = {
      "ya-existe": "Esta solicitud ya tiene un presupuesto.",
      "no-existe": "La solicitud ya no existe.",
      conflicto:
        "La solicitud cambió mientras se creaba el presupuesto. Recarga e inténtalo de nuevo.",
    } as const;

    return { status: "error", message: mensajes[resultado.motivo] };
  }

  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`);
  revalidatePath("/app/solicitudes");
  revalidatePath(`/app/solicitudes/${parsed.data.requestId}`);

  redirect(`/admin/solicitudes/${parsed.data.requestId}?presupuesto=1`);
}

export async function cambiarEstadoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const personal = await requerirPersonalTaller();

  const parsed = cambioEstadoSchema.safeParse({
    requestId: formData.get("requestId"),
    estadoEsperado: formData.get("estadoEsperado"),
    estadoNuevo: formData.get("estadoNuevo"),
    motivo: formData.get("motivo") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa el cambio de estado.",
      fieldErrors,
    };
  }

  const resultado = await cambiarEstadoSolicitud({
    requestId: parsed.data.requestId,
    estadoEsperado: parsed.data.estadoEsperado,
    estadoNuevo: parsed.data.estadoNuevo,
    actorId: personal.id,
    rol: personal.role,
    motivo: parsed.data.motivo,
  });

  if (!resultado.ok) {
    const mensajes: Record<MotivoCambioEstado, string> = {
      "no-existe": "La solicitud ya no existe.",
      "mismo-estado": "La solicitud ya está en ese estado.",
      "sin-presupuesto": "Crea un presupuesto antes de marcar aceptada o rechazada.",
      "no-asignada": "No puedes cambiar el estado de esta reparación.",
      "transicion-invalida": "Ese cambio no está permitido.",
      "motivo-obligatorio": "Indica el motivo de la corrección.",
      conflicto: "La solicitud ha cambiado. Recarga antes de volver a intentarlo.",
      "requiere-pago": "Registra el pago antes de entregar.",
      "factura-vigente": "Tiene factura vigente: emite antes la rectificativa.",
    };

    return { status: "error", message: mensajes[resultado.motivo] };
  }

  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`);
  revalidatePath("/app/solicitudes");
  revalidatePath(`/app/solicitudes/${parsed.data.requestId}`);
  revalidatePath("/trabajador");
  revalidatePath(`/trabajador/reparaciones/${parsed.data.requestId}`);

  if (personal.role === "trabajador") {
    redirect(`/trabajador/reparaciones/${parsed.data.requestId}?estado=1`);
  }

  redirect(`/admin/solicitudes/${parsed.data.requestId}?estado=1`);
}
