# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea. Resume o elimina lo que ya no aporte.

## Estado actual
- **Tareas 1 y 2 completadas**: scaffold + esquema Prisma migrado y seed de `Config`. build/lint/typecheck/tests en verde.
- Siguiente: Auth.js + registro/login + roles.

## Stack efectivo
- Node 24.22.1 LTS (.nvmrc) · Next 15.5.28 · React 19.1 · TS 5 estricto
- Tailwind v4 · ESLint 9 flat config · Vitest 5
- Prisma 7.10.1 + `@prisma/adapter-pg` + `pg` · PostgreSQL 16.15 nativo (winget)

## Entorno local
- Windows/PowerShell: `npm.ps1` bloqueado → usar `npm.cmd` y `npx.cmd`.
- Postgres: servicio `postgresql-x64-16`, puerto 5432, user/pass `postgres`/`postgres`, BD `softhard`.
- Prisma 7 **no** carga `.env`: `prisma.config.ts` importa `dotenv/config`.

## Esquema (Tarea 2)
- Modelos: `User`, `ServiceRequest`, `Quote`, `Config` (tablas `users`, `service_requests`, `quotes`, `config`).
- Enums con valores en español. `ServiceStatus` completo hasta `entregada` para no migrar el enum en Fase 3.
- `Quote.diagnosticFee` = copia de X: los presupuestos históricos no se alteran si X cambia.
- Importe final: acepta → presupuesto - X; rechaza → X. Se guarda en `Quote.finalAmount`.
- `ServiceRequest.expiresAt` se calcula al crear el presupuesto; expiración perezosa, sin cron.
- Cliente generado en `src/generated/prisma` (ignorado por git). Migración `20261022150029_init` aplicada.

## Decisiones
- Roles: cliente, trabajador, encargado, admin. En Fase 1 `admin` = `encargado`.
- Pagos simulados. Datos ficticios en demo.
- `build` sin Turbopack; `dev` con Turbopack.
- Dinero en `Decimal(10,2)`.

## Próximos pasos
- [x] Seed de `Config` (X = 30 €, N = 7 días) — `prisma db seed` con `tsx`, idempotente
- [ ] Auth.js v5 + registro/login + bcrypt + roles
- [ ] Middleware de protección `/app/*` y `/admin/*` (+ checks en layouts/actions)
- [ ] Landing pública (hero, servicios, cómo funciona, contacto)
- [ ] Solicitud de servicio con Zod + listado y detalle del cliente
- [ ] Panel encargado: ver todas y cambiar estado
- [ ] Tests de auth y creación de solicitud
- [ ] README + capturas

## Aprendizajes / notas
- Prisma 7: driver adapter obligatorio, `output` obligatorio, `--to-schema` (no `--to-schema-datamodel`).
- `prisma@latest` apunta a 8.0.0-rc → fijar versión explícita.
- `es-ES` no agrupa miles con 4 cifras (`1234,50 €`).
- npm 11 avisa de postinstalls no aprobados (`unrs-resolver`, `@prisma/engines`); todo funciona igual.
