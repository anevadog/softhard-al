import type { DefaultSession } from "next-auth";

import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

// En Auth.js v5 el JWT se define en @auth/core/jwt: sin esta segunda
// augmentación, `token.id`/`token.role` se resuelven como `unknown`.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
