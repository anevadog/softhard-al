# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Tareas 1–5 completadas**: scaffold, Prisma + seed, Auth.js v5, landing y solicitudes.
- Siguiente: panel del encargado (ver todas las solicitudes y cambiar estado).

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
- Grupo `(public)` con layout; `/` estático. Hero, Servicios, Cómo funciona y Contacto.
- Copy en `src/lib/site-content.ts`; componentes en `src/components/site/`; títulos cortos por `template`.

## Solicitudes de servicio
- Validación Zod, datos y acción en `src/lib/validations/`, `src/server/data/` y `src/server/actions/`.
- `clientId` sale de la sesión; Zod descarta `clientId`/`status`/`expiresAt` inyectados.
- Formulario controlado con `onSubmit` + `useTransition`: evita el reset de React 19 y conserva lo escrito.
- `/app/solicitudes` filtra por cliente; badges de estado en un mapa estático (Tailwind los detecta).
- Fase 1: solo listado y franja horaria (sin fecha concreta ni página de detalle).

## Decisiones
- Roles: cliente, trabajador, encargado, admin. En Fase 1 `admin` = `encargado`.
- Pagos simulados, datos ficticios, dinero en `Decimal(10,2)`; migración `20261022150029_init` aplicada.
- `build` sin Turbopack (`dev` con Turbopack); tema claro fijo y Geist en `globals.css`.

## Próximos pasos
- [x] Seed `Config` (X = 30 €, N = 7 días) · Auth.js + roles · landing · solicitud + listado
- [ ] Panel encargado: ver todas y cambiar estado
- [ ] Deuda: rate limiting en login · README + capturas

## Aprendizajes / notas
- Prisma 7: driver adapter y `output` obligatorios, `--to-schema`; `@latest` apunta a 8.0.0-rc.
- Auth.js v5: augmentar **`@auth/core/jwt`** y `next-auth/jwt`, o `token.id` es `unknown`.
- Grupo de ruta `(x)` no crea URL: las rutas reales van en carpetas (`app`, `admin`, `(public)`).
