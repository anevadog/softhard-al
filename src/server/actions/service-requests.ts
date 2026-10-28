"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { decisionSchema } from "@/lib/validations/quote";
import { serviceRequestSchema } from "@/lib/validations/service-request";
import {
  crearSolicitudCliente,
  decidirPresupuestoCliente,
} from "@/server/data/service-requests";

export async function crearSolicitudAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Defensa en profundidad: el layout de /app ya exige sesión, pero una
  // Server Action es un endpoint y debe comprobarlo por su cuenta.
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/app/solicitudes/nueva");
  }

  const parsed = serviceRequestSchema.safeParse({
    equipmentType: formData.get("equipmentType"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    issue: formData.get("issue"),
    modality: formData.get("modality"),
    timeSlot: formData.get("timeSlot"),
    address: formData.get("address") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa los datos del formulario.",
      fieldErrors,
    };
  }

  try {
    // El propietario sale SIEMPRE de la sesión, nunca del formulario.
    await crearSolicitudCliente(session.user.id, parsed.data);
  } catch (error) {
    console.error("Error creando solicitud de servicio:", error);

    return {
      status: "error",
      message: "No se pudo crear la solicitud. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/solicitudes");

  redirect("/app/solicitudes?creada=1");
}

export async function decidirPresupuestoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Una Server Action es un endpoint público: sesión y propiedad se comprueban
  // aquí, aunque la página ya las haya validado.
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/app/solicitudes");
  }

  const parsed = decisionSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Decisión no válida." };
  }

  const resultado = await decidirPresupuestoCliente(
    parsed.data.requestId,
    session.user.id,
    parsed.data.decision,
  );

  if (!resultado.ok) {
    const mensajes = {
      "no-existe": "La solicitud ya no existe.",
      "sin-presupuesto": "Esta solicitud todavía no tiene presupuesto.",
      "no-decidible": "El presupuesto ya no admite cambios.",
      expirado: "El presupuesto ha caducado. Contacta con el taller.",
    } as const;

    return { status: "error", message: mensajes[resultado.motivo] };
  }

  revalidatePath("/app");
  revalidatePath("/app/solicitudes");
  revalidatePath(`/app/solicitudes/${parsed.data.requestId}`);
  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${parsed.data.requestId}`);

  redirect(
    `/app/solicitudes/${parsed.data.requestId}?decision=${
      resultado.decision === "aceptar" ? "aceptada" : "rechazada"
    }`,
  );
}
