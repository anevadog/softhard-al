"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requerirStaff } from "@/server/authorization";
import { reintentarEmailFallido } from "@/server/data/emails";
import { programarEnvioEmails } from "@/server/email-dispatch";

const reintentoSchema = z.object({ id: z.string().trim().min(1) });

/** "Reintentar" de `/admin/emails`: solo staff y solo sobre un `fallido`. */
export async function reintentarEmailAction(formData: FormData): Promise<void> {
  await requerirStaff();

  const parsed = reintentoSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return;
  }

  if (await reintentarEmailFallido(parsed.data.id)) {
    programarEnvioEmails();
  }

  revalidatePath("/admin/emails");
}
