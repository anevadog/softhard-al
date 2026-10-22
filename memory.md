# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Fase 1 completada (tareas 1–8)**: scaffold, Prisma, Auth, landing, solicitudes, panel, decisión y README.
- Siguiente: planificar la Fase 2 (catálogo de productos y pedidos). Documentación: `README.md` y `docs/specs/fase-1.md`.

## Stack efectivo
- Node 24.22.1 LTS · Next 15.5.28 · React 19.1 · TS 5 · Tailwind v4 · Vitest 5 · Zod 4.6.7
- Prisma 7.10.1 + adapter-pg · PostgreSQL 16.15 nativo (winget) · ESLint 9
- Auth: next-auth 5.0.0-beta.32 (beta) + bcrypt 6 nativo (coste 12)

## Entorno local
- PowerShell: `npm.ps1` bloqueado → `npm.cmd`/`npx.cmd`. Postgres `postgresql-x64-16`:5432, `postgres`/`postgres`, BD `softhard`.
- Prisma 7 no carga `.env`: `prisma.config.ts` importa `dotenv/config`.

## Autenticación
- `auth.config.ts` edge-safe; `auth.ts` añade Credentials. JWT 7 días; rol en token y `/admin` **revalida en BD**.
- `authz.ts` decide (`puedeAcceder`): `/app` cualquier sesión, `/admin` solo staff; middleware + layouts.
- Registro público siempre `cliente`; bcrypt ≤ 72 bytes; demo `@demo.local` con `Demo1234!`.

## Landing y solicitudes
- Grupo `(public)`, `/` estático; copy en `src/lib/site-content.ts` y componentes en `src/components/site/`.
- Validación Zod, datos y acción en `src/lib/validations/`, `src/server/data/` y `src/server/actions/`.
- `clientId` sale de la sesión; Zod descarta `clientId`/`status`/`expiresAt` inyectados.
- Formulario controlado con `onSubmit` + `useTransition`: evita el reset de React 19.
- `/app/solicitudes` filtra por cliente; tarjetas enlazadas al detalle.

## Panel y decisión
- `/admin` redirige a `/admin/solicitudes`; `requerirStaff()` revalida rol en BD en cada acción.
- Presupuesto: X e N de `Config`; X copiada en `diagnosticFee`; `finalAmount = presupuesto − X`; rechazo → `X`.
- Un presupuesto por solicitud; importes en céntimos y guardados como cadena.
- Cliente decide si está `pendiente`, la solicitud sigue abierta y no venció; acepta/rechaza en el detalle.
- Expiración perezosa al leer: `expirado`/`expirada` (sin cron); propiedad por `{ id, clientId }`.

## Decisiones
- Roles: cliente, trabajador, encargado, admin. En Fase 1 `admin` = `encargado`.
- Pagos simulados, datos ficticios; `build` sin Turbopack (`dev` con Turbopack); tema claro fijo.

## Próximos pasos
- [x] Tareas 1–8: Fase 1 completa (última: README)
- [ ] Planificar Fase 2: catálogo de productos y pedidos
- [ ] Deuda: rate limiting en login · emails · tests de integración

## Aprendizajes / notas
- Prisma 7: driver adapter y `output` obligatorios, `--to-schema`; `@latest` apunta a 8.0.0-rc.
- Auth.js v5: augmentar **`@auth/core/jwt`** y `next-auth/jwt`, o `token.id` es `unknown`.
