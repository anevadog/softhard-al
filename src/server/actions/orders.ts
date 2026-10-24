"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type {
  CheckoutActionResult,
  MotivoPedidoInvalido,
} from "@/lib/orders";
import { checkoutSchema } from "@/lib/validations/order";
import {
  crearPedidoCliente,
  type ResultadoCrearPedido,
} from "@/server/data/orders";

function mensajeDeError(motivo: MotivoPedidoInvalido): string {
  switch (motivo) {
    case "carrito-vacio":
      return "Tu carrito está vacío.";
    case "datos-invalidos":
      return "El carrito no es válido. Recarga la página e inténtalo de nuevo.";
    case "producto-no-disponible":
      return "Algunos productos ya no están disponibles. Hemos actualizado el carrito; revisa las cantidades.";
    case "stock-insuficiente":
      return "Algunos productos ya no tienen stock suficiente. Hemos actualizado el carrito; revisa las cantidades.";
    case "importe-excesivo":
      return "El importe del pedido es demasiado alto. Reduce las cantidades.";
  }
}

function revalidarCatalogo() {
  revalidatePath("/productos");
  revalidatePath("/admin/productos");
}

/**
 * Endpoint público de compra. Igual que el resto de Server Actions, vuelve a
 * comprobar la sesión por su cuenta: el estado de la UI no es seguridad.
 */
export async function finalizarCompraAction(
  input: unknown,
): Promise<CheckoutActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/carrito");
  }

  const parsed = checkoutSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      motivo: "datos-invalidos",
      message: mensajeDeError("datos-invalidos"),
    };
  }

  let resultado: ResultadoCrearPedido;

  try {
    resultado = await crearPedidoCliente(
      session.user.id,
      parsed.data.items,
      parsed.data.idempotencyKey,
    );
  } catch (error) {
    console.error("Error creando pedido:", error);

    return {
      ok: false,
      motivo: "error",
      message: "No se pudo crear el pedido. Inténtalo de nuevo más tarde.",
    };
  }

  if (!resultado.ok) {
    revalidarCatalogo();

    return {
      ok: false,
      motivo: resultado.motivo,
      message: mensajeDeError(resultado.motivo),
      productIds: resultado.productIds,
    };
  }

  revalidarCatalogo();
  revalidatePath("/app/pedidos");

  return { ok: true, pedidoId: resultado.pedidoId };
}
