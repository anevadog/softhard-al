"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import {
  nifSchema,
  rectificativaSchema,
  reemisionSchema,
} from "@/lib/validations/invoices";
import { requerirStaff } from "@/server/authorization";
import {
  emitirRectificativa,
  reemitirFactura,
} from "@/server/data/invoices";
import { actualizarNif } from "@/server/data/profile";

function revalidarEntidad(entidad: "pedido" | "solicitud", id: string) {
  revalidatePath("/admin/facturas");
  revalidatePath("/app/facturas");

  if (entidad === "pedido") {
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath(`/app/pedidos/${id}`);
  } else {
    revalidatePath(`/admin/solicitudes/${id}`);
    revalidatePath(`/app/solicitudes/${id}`);
  }
}

/** Rectificativa total y manual, solo staff y con motivo. */
export async function emitirRectificativaAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = rectificativaSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    motivo: formData.get("motivo") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return { status: "error", message: "Revisa el motivo de la rectificativa.", fieldErrors };
  }

  const resultado = await emitirRectificativa({
    invoiceId: parsed.data.invoiceId,
    motivo: parsed.data.motivo,
    staffId: staff.id,
  });

  if (!resultado.ok) {
    return {
      status: "error",
      message:
        resultado.motivo === "no-existe"
          ? "La factura ya no existe."
          : "Esta factura ya no está vigente: ya tiene rectificativa.",
    };
  }

  revalidatePath("/admin/facturas");
  revalidatePath("/app/facturas");
  redirect(`/admin/facturas/${resultado.id}?emitida=1`);
}

/** "Emitir factura de nuevo" a partir del cobro registrado, solo staff. */
export async function reemitirFacturaAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = reemisionSchema.safeParse({
    entidad: formData.get("entidad"),
    id: formData.get("id"),
    motivo: formData.get("motivo") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return { status: "error", message: "Revisa el motivo de la re-emisión.", fieldErrors };
  }

  const { entidad, id, motivo } = parsed.data;
  const resultado = await reemitirFactura({
    entidad: { tipo: entidad, id },
    motivo,
    staffId: staff.id,
  });

  if (!resultado.ok) {
    return {
      status: "error",
      message:
        resultado.motivo === "no-existe"
          ? "Ya no existe."
          : "Ahora no se puede emitir de nuevo: necesita un cobro y una factura rectificada sin sustituta.",
    };
  }

  revalidarEntidad(entidad, id);
  redirect(`/admin/facturas/${resultado.id}?emitida=1`);
}

/** El cliente edita su propio NIF (vacío lo borra). */
export async function actualizarNifAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/app/perfil");
  }

  const parsed = nifSchema.safeParse({ nif: formData.get("nif") ?? "" });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return { status: "error", message: "Revisa el NIF.", fieldErrors };
  }

  await actualizarNif(session.user.id, parsed.data.nif);

  revalidatePath("/app/perfil");
  redirect(`/app/perfil?nif=${parsed.data.nif ? "guardado" : "eliminado"}`);
}
