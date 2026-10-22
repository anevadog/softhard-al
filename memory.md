# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Tareas 1–6 completadas**: scaffold, Prisma + seed, Auth.js, landing, solicitudes y panel.
- Siguiente: aceptar/rechazar presupuesto desde el área del cliente.

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

## Landing pública
- Grupo `(public)`, `/` estático; copy en `src/lib/site-content.ts` y componentes en `src/components/site/`.

## Solicitudes de servicio
- Validación Zod, datos y acción en `src/lib/validations/`, `src/server/data/` y `src/server/actions/`.
- `clientId` sale de la sesión; Zod descarta `clientId`/`status`/`expiresAt` inyectados.
- Formulario controlado con `onSubmit` + `useTransition`: evita el reset de React 19.
- `/app/solicitudes` filtra por cliente; badges de estado en un mapa estático (Tailwind los detecta).

## Panel del encargado
- `/admin` redirige a `/admin/solicitudes`; filtro por estado con contadores (`?estado=`).
- `requerirStaff()` revalida el rol en BD en cada Server Action (el JWT no basta).
- Presupuesto: X e N de `Config`; copia de X en `diagnosticFee`; `finalAmount = presupuesto − X`.
- Al rechazar, `finalAmount = X`; la creación pasa la solicitud a `diagnosticada` (transacción).
- Un presupuesto por solicitud (`requestId` único); importes en céntimos, guardados como cadena.

## Decisiones
- Roles: cliente, trabajador, encargado, admin. En Fase 1 `admin` = `encargado`.
- Pagos simulados, datos ficticios; `build` sin Turbopack (`dev` con Turbopack); tema claro fijo.

## Próximos pasos
- [x] Seed `Config` · Auth.js + roles · landing · solicitudes · panel del encargado
- [ ] Cliente: aceptar/rechazar presupuesto y ver importe final
- [ ] Deuda: rate limiting en login · README + capturas

## Aprendizajes / notas
- Prisma 7: driver adapter y `output` obligatorios, `--to-schema`; `@latest` apunta a 8.0.0-rc.
- Auth.js v5: augmentar **`@auth/core/jwt`** y `next-auth/jwt`, o `token.id` es `unknown`.
