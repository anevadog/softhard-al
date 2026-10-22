import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { esStaff } from "@/lib/authz";
import { prisma } from "@/lib/db";

export type UsuarioStaff = {
  id: string;
  name: string;
  role: "encargado" | "admin";
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
