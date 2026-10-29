"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  confirmarPago,
  iniciarPago,
  obtenerSesionMock,
  type EntidadPago,
} from "@/server/data/online-payments";
import { proveedorMockActivo } from "@/server/providers/payments";

const idSchema = z.object({ id: z.string().trim().min(1) });

async function clienteActual(callbackUrl: string): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return session.user.id;
}

async function iniciar(tipo: EntidadPago["tipo"], formData: FormData): Promise<never> {
  const parsed = idSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    notFound();
  }

  const ruta = tipo === "pedido" ? `/app/pedidos/${parsed.data.id}` : `/app/solicitudes/${parsed.data.id}`;
  const clienteId = await clienteActual(ruta);
  const resultado = await iniciarPago({ entidad: { tipo, id: parsed.data.id }, clienteId });

  if (!resultado.ok) {
    if (resultado.motivo === "no-existe") {
      notFound();
    }

    redirect(`${ruta}?pago=no-disponible`);
  }

  redirect(resultado.urlPago);
}

/** "Pagar con tarjeta" de un pedido pendiente: crea la sesión y va a la pasarela. */
export async function iniciarPagoPedidoAction(formData: FormData): Promise<void> {
  await iniciar("pedido", formData);
}

/** "Pagar con tarjeta" de una reparación lista con importe pendiente. */
export async function iniciarPagoSolicitudAction(formData: FormData): Promise<void> {
  await iniciar("solicitud", formData);
}

const confirmacionMockSchema = z.object({
  sesion: z.string().trim().min(1),
  resultado: z.enum(["pagado", "fallido", "abandonado"]),
});

const AVISO_RETORNO = {
  completada: "ok",
  reembolsada: "reembolsado",
  fallida: "error",
  abandonada: "abandonado",
  pendiente: "error",
} as const;

/**
 * Botones de la página mock. Hace lo mismo que haría el webhook de una pasarela
 * real: llama a `confirmarPago`. El importe y la entidad salen de la sesión
 * guardada en el servidor; del formulario solo se usa qué botón se pulsó.
 */
export async function confirmarPagoMockAction(formData: FormData): Promise<void> {
  if (!proveedorMockActivo()) {
    notFound();
  }

  const parsed = confirmacionMockSchema.safeParse({
    sesion: formData.get("sesion"),
    resultado: formData.get("resultado"),
  });

  if (!parsed.success) {
    notFound();
  }

  const clienteId = await clienteActual(`/pago/mock/${parsed.data.sesion}`);
  const sesion = await obtenerSesionMock(parsed.data.sesion, clienteId);

  if (!sesion) {
    notFound();
  }

  const resultado = await confirmarPago({ referencia: sesion.providerRef, resultado: parsed.data.resultado });
  const destino = resultado?.returnPath ?? sesion.returnPath;

  revalidatePath(destino);
  revalidatePath("/app/pedidos");
  revalidatePath("/app/solicitudes");
  revalidatePath("/app/facturas");

  redirect(`${destino}?pago=${AVISO_RETORNO[resultado?.estado ?? "pendiente"]}`);
}
