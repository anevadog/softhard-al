import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";
import { puedeAcceder } from "@/lib/authz";

// Instancia edge-safe: solo usa auth.config, sin Prisma ni bcrypt.
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const role = request.auth?.user?.role ?? null;

  if (puedeAcceder(pathname, role)) {
    return;
  }

  const url = new URL(role ? "/app" : "/login", request.nextUrl.origin);

  if (!role) {
    url.searchParams.set("callbackUrl", pathname);
  }

  return Response.redirect(url);
});

export const config = {
  // `/pago`: la pasarela simulada exige sesión (la propiedad se comprueba en la página).
  matcher: ["/app/:path*", "/admin/:path*", "/trabajador/:path*", "/pago/:path*"],
};
