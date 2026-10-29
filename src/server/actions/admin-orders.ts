"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import { puedeCambiarEstadoPedido } from "@/lib/orders";
import { cambiarEstadoPedidoSchema } from "@/lib/validations/order";
import { requerirStaff } from "@/server/authorization";
import { cambiarEstadoPedidoAdmin } from "@/server/data/admin-orders";
import { liberarPedidosCaducadosSinFallar } from "@/server/data/orders";

export async function cambiarEstadoPedidoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = cambiarEstadoPedidoSchema.safeParse({
    orderId: formData.get("orderId"),
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

  if (
    !puedeCambiarEstadoPedido(
      parsed.data.estadoEsperado,
      parsed.data.estadoNuevo,
    )
  ) {
    return {
      status: "error",
      message: "Ese cambio de estado no está permitido.",
    };
  }

  // Un pedido vencido se marca `caducado` (y libera stock) antes de que el
  // staff pueda cobrarlo o cancelarlo.
  await liberarPedidosCaducadosSinFallar();

  let resultado;

  try {
    resultado = await cambiarEstadoPedidoAdmin({
      orderId: parsed.data.orderId,
      estadoEsperado: parsed.data.estadoEsperado,
      estadoNuevo: parsed.data.estadoNuevo,
      motivo: parsed.data.motivo,
      userId: staff.id,
    });
  } catch (error) {
    console.error("Error cambiando el estado del pedido:", error);

    return {
      status: "error",
      message: "No se pudo cambiar el estado. Inténtalo de nuevo.",
    };
  }

  if (!resultado.ok) {
    return {
      status: "error",
      message:
        resultado.motivo === "transicion-invalida"
          ? "Ese cambio de estado no está permitido."
          : resultado.motivo === "factura-vigente"
            ? "Cancela la factura primero: emite su rectificativa y vuelve a cancelar el pedido."
            : "El pedido ha cambiado mientras lo editabas. Recarga la página y revisa el estado actual.",
    };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${parsed.data.orderId}`);
  revalidatePath("/app/pedidos");
  revalidatePath(`/app/pedidos/${parsed.data.orderId}`);

  if (resultado.productIds.length > 0) {
    revalidatePath("/admin/productos");
    revalidatePath("/productos");

    for (const productId of new Set(resultado.productIds)) {
      revalidatePath(`/admin/productos/${productId}`);
      revalidatePath(`/productos/${productId}`);
    }
  }

  redirect(`/admin/pedidos/${parsed.data.orderId}?estado=1`);
}
