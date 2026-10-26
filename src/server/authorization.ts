import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { esPersonalTaller, esStaff } from "@/lib/authz";
import { prisma } from "@/lib/db";

export type UsuarioStaff = {
  id: string;
  name: string;
  role: "encargado" | "admin";
};

export type UsuarioTaller = {
  id: string;
  name: string;
  role: "trabajador" | "encargado" | "admin";
};

/**
 * Guard para Server Actions del panel: una acción es un endpoint público, así
 * que no basta con el layout ni con el rol del JWT. Se revalida contra la BD.
 */
export async function requerirStaff(): Promise<UsuarioStaff> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/solicitudes");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true },
  });

  if (!user || !esStaff(user.role)) {
    redirect("/app");
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role === "admin" ? "admin" : "encargado",
  };
}

/**
 * Guard para el área de taller y sus Server Actions. Incluye a trabajadores y
 * a encargado/admin; igual que el panel, revalida el rol contra la BD.
 */
export async function requerirPersonalTaller(): Promise<UsuarioTaller> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/trabajador");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true },
  });

  if (!user || !esPersonalTaller(user.role)) {
    redirect("/app");
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
  };
}
