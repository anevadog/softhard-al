# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea. Resume o elimina lo que ya no aporte.

## Estado actual
- **Tareas 1–3 completadas**: scaffold, esquema Prisma + seed, Auth.js v5 (registro/login/roles).
- Siguiente: landing pública y solicitud de servicio.

## Stack efectivo
- Node 24.22.1 LTS (.nvmrc) · Next 15.5.28 · React 19.1 · TS 5 estricto
- Tailwind v4 · ESLint 9 flat config · Vitest 5 · Zod 4.6.7
- Prisma 7.10.1 + `@prisma/adapter-pg` + `pg` · PostgreSQL 16.15 nativo (winget)
- Auth: `next-auth@5.0.0-beta.32` (sigue en beta) + bcrypt 6 nativo (coste 12)

## Entorno local
- Windows/PowerShell: `npm.ps1` bloqueado → usar `npm.cmd` y `npx.cmd`.
- Postgres: servicio `postgresql-x64-16`, puerto 5432, user/pass `postgres`/`postgres`, BD `softhard`.
- Prisma 7 **no** carga `.env`: `prisma.config.ts` importa `dotenv/config`.

## Autenticación (Tarea 3)
- `src/lib/auth.config.ts` es edge-safe (sin Prisma/bcrypt); `src/lib/auth.ts` añade Credentials.
- Sesión JWT 7 días, `updateAge` 24 h. El rol viaja en el token; el layout de `/admin` **revalida rol en BD**.
- `src/lib/authz.ts` concentra la regla (`puedeAcceder`): `/app` cualquier sesión, `/admin` solo staff.
- Middleware (`src/middleware.ts`) con matcher `/app/*` y `/admin/*`; los layouts repiten el check.
- Registro público crea siempre `role: "cliente"`; el rol nunca se acepta del formulario.
- bcrypt se limita a 72 bytes en Zod; el login usa hash de relleno para no filtrar cuentas por tiempo.
- Demo (`prisma db seed`, `Demo1234!`): cliente/trabajador/encargado/admin `@demo.local`.
- Rutas reales `src/app/app/` y `src/app/admin/`: los grupos `(app)`/`(admin)` no crean segmento.
- Formularios en `src/app/(auth)/login|register` con `useActionState` y Server Actions.

## Decisiones
- Roles: cliente, trabajador, encargado, admin. En Fase 1 `admin` = `encargado`.
- Pagos simulados y datos ficticios. Dinero en `Decimal(10,2)`.
- `build` sin Turbopack; `dev` con Turbopack.

## Próximos pasos
- [x] Seed de `Config` (X = 30 €, N = 7 días)
- [x] Auth.js v5 + registro/login + bcrypt + roles
- [x] Middleware `/app/*` y `/admin/*` + checks en layouts
- [ ] Landing pública (hero, servicios, cómo funciona, contacto)
- [ ] Solicitud de servicio con Zod + listado y detalle del cliente
- [ ] Panel encargado: ver todas y cambiar estado
- [ ] Tests de creación de solicitud
- [ ] Deuda: rate limiting en login; metadata raíz aún dice "Create Next App"
- [ ] README + capturas

## Aprendizajes / notas
- Prisma 7: driver adapter y `output` obligatorios, `--to-schema`; `@latest` apunta a 8.0.0-rc → fijar versión.
- Auth.js v5: augmentar **`@auth/core/jwt`** además de `next-auth/jwt`, o `token.id` cae en `unknown`.
- `es-ES` no agrupa miles con 4 cifras (`1234,50 €`).
