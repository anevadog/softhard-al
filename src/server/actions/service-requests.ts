"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { serviceRequestSchema } from "@/lib/validations/service-request";
import { crearSolicitudCliente } from "@/server/data/service-requests";

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
