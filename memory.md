# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Tareas 1–4 completadas**: scaffold, Prisma + seed, Auth.js v5 y landing pública.
- Siguiente: solicitud de servicio desde el área de cliente.

## Stack efectivo
- Node 24.22.1 LTS · Next 15.5.28 · React 19.1 · TS 5 · Tailwind v4 · Vitest 5 · Zod 4.6.7
- Prisma 7.10.1 + adapter-pg + pg · PostgreSQL 16.15 nativo (winget) · ESLint 9
- Auth: next-auth 5.0.0-beta.32 (sigue en beta) + bcrypt 6 nativo (coste 12)

## Entorno local
- PowerShell: `npm.ps1` bloqueado → usar `npm.cmd` y `npx.cmd`.
- Postgres `postgresql-x64-16`:5432, user/pass `postgres`/`postgres`, BD `softhard`.
- Prisma 7 **no** carga `.env`: `prisma.config.ts` importa `dotenv/config`.

## Autenticación
- `auth.config.ts` edge-safe (sin Prisma/bcrypt); `auth.ts` añade Credentials.
- JWT 7 días (`updateAge` 24 h); el rol va en el token y `/admin` **revalida rol en BD**.
- `authz.ts` decide (`puedeAcceder`): `/app` cualquier sesión, `/admin` solo staff; middleware + layouts.
- Registro público siempre `role: "cliente"`; bcrypt limitado a 72 bytes; hash de relleno en login.
- Demo (`prisma db seed`, `Demo1234!`): cliente/trabajador/encargado/admin `@demo.local`.

## Landing pública
- Grupo `(public)` con layout (cabecera/pie) y `page.tsx`; `/` se genera estático.
- Hero (con panel de seguimiento), Servicios, Cómo funciona y Contacto.
- Copy y datos en `src/lib/site-content.ts`; componentes en `src/components/site/`.
- Metadatos con `template`: los hijos usan títulos cortos. Contacto ficticio, sin formulario.

## Decisiones
- Roles: cliente, trabajador, encargado, admin. En Fase 1 `admin` = `encargado`.
- Pagos simulados, datos ficticios, dinero en `Decimal(10,2)`; migración `20261022150029_init` aplicada.
- `build` sin Turbopack (`dev` con Turbopack); tema claro fijo y Geist aplicada en `globals.css`.

## Próximos pasos
- [x] Seed de `Config` (X = 30 €, N = 7 días) · Auth.js + roles · middleware · landing pública
- [ ] Solicitud de servicio con Zod + listado y detalle del cliente
- [ ] Panel encargado: ver todas y cambiar estado
- [ ] Tests de creación de solicitud
- [ ] Deuda: rate limiting en login
- [ ] README + capturas

## Aprendizajes / notas
- Prisma 7: driver adapter y `output` obligatorios, `--to-schema`; `@latest` apunta a 8.0.0-rc.
- Auth.js v5: augmentar **`@auth/core/jwt`** además de `next-auth/jwt`, o `token.id` es `unknown`.
- Un grupo de ruta `(x)` no crea URL: las rutas reales van en carpetas (`app`, `admin`, `(public)`).
- `es-ES` no agrupa miles con 4 cifras (`1234,50 €`).
