"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import { MIN_MOTIVO_AJUSTE } from "@/lib/payments";
import { registrarCobroSchema } from "@/lib/validations/payments";
import { requerirStaff } from "@/server/authorization";
import { liberarPedidosCaducadosSinFallar } from "@/server/data/orders";
import {
  registrarCobroPedido,
  registrarCobroSolicitud,
  type MotivoCobroRechazado,
} from "@/server/data/payments";

const MENSAJES: Record<MotivoCobroRechazado, string> = {
  "no-existe": "Ya no existe.",
  "ya-cobrado": "El cobro ya está registrado.",
  caducado: "El pedido ha caducado: su stock se ha liberado y ya no se puede cobrar.",
  "no-cobrable": "Ahora mismo no hay nada que cobrar aquí.",
  "importe-no-permitido": "Solo un administrador puede cambiar el importe del cobro.",
  "motivo-obligatorio": `Indica en la nota el motivo del cambio de importe (mínimo ${MIN_MOTIVO_AJUSTE} caracteres).`,
  conflicto: "Ha cambiado mientras registrabas el cobro. Recarga y revísalo.",
};

/**
 * Registro manual de un cobro (pedido o solicitud) desde el panel. Solo staff;
 * que el importe sea el esperado, o que quien lo cambia sea admin con motivo,
 * se decide en la capa de datos contra la BD, no con lo que manda el
 * formulario.
 */
export async function registrarCobroAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = registrarCobroSchema.safeParse({
    entidad: formData.get("entidad"),
    id: formData.get("id"),
    importe: formData.get("importe"),
    metodo: formData.get("metodo"),
    nota: formData.get("nota") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return { status: "error", message: "Revisa los datos del cobro.", fieldErrors };
  }

  const { entidad, id, importe, metodo, nota } = parsed.data;
  const datos = { id, importe, metodo, nota, staff: { id: staff.id, role: staff.role } };

  let resultado;

  try {
    if (entidad === "pedido") {
      // Un pedido vencido se marca caducado (y libera stock) antes de cobrarlo.
      await liberarPedidosCaducadosSinFallar();
      resultado = await registrarCobroPedido(datos);
    } else {
      resultado = await registrarCobroSolicitud(datos);
    }
  } catch (error) {
    console.error("Error registrando el cobro:", error);

    return { status: "error", message: "No se pudo registrar el cobro. Inténtalo de nuevo." };
  }

  if (!resultado.ok) {
    return { status: "error", message: MENSAJES[resultado.motivo] };
  }

  if (entidad === "pedido") {
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath("/app/pedidos");
    revalidatePath(`/app/pedidos/${id}`);
    redirect(`/admin/pedidos/${id}?cobro=1`);
  }

  revalidatePath("/admin/solicitudes");
  revalidatePath(`/admin/solicitudes/${id}`);
  revalidatePath(`/app/solicitudes/${id}`);
  redirect(`/admin/solicitudes/${id}?cobro=1`);
}
