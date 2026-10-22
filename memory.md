# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea. Resume o elimina lo que ya no aporte.

## Estado actual
- Fase 1 en curso: landing, auth con roles, solicitud de servicio, panel encargado mínimo.
- **Tarea 1 completada**: scaffold verificado (build, lint, typecheck y tests en verde).
- Repo privado, uso portfolio.

## Stack efectivo (versiones instaladas)
- Node 24.22.1 LTS (.nvmrc) · Next 15.5.28 (App Router) · React 19.1 · TS 5 estricto
- Tailwind v4 (CSS-first, sin tailwind.config) · ESLint 9 flat config
- Vitest 5.0.5 (environment node) · Prisma pendiente de instalar
- Auth.js v5 (JWT) + bcrypt, Zod: pendientes

## Decisiones tomadas
- Roles: cliente, trabajador, encargado, admin.
- Regla descuento: X = tarifa diagnóstico. Acepta → total = presupuesto - X. Rechaza → se cobra X.
- Pagos simulados en Fase 1. Datos ficticios en demo.
- `build` sin Turbopack (beta en 15.5); `dev` con Turbopack.
- Vitest usa `resolve.tsconfigPaths` nativo de Vite 8, sin `vite-tsconfig-paths`.
- `.gitignore`: `next-env.d.ts` ignorado (lo regenera Next), `!.env.example` conservado.

## Próximos pasos
- [x] Tarea 1: scaffold Next.js + Tailwind + Vitest
- [x] Docker compose Postgres (archivo listo, sin arrancar)
- [ ] Esquema Prisma Fase 1 + `npm i prisma @prisma/client` + crear `.env`
- [ ] Auth.js + registro/login + roles
- [ ] Middleware de protección de rutas
- [ ] Landing pública
- [ ] Formulario solicitud de servicio
- [ ] Área cliente: listar solicitudes
- [ ] Panel encargado: ver y cambiar estado
- [ ] Tests mínimos (auth + solicitud)
- [ ] README + capturas

## Aprendizajes / notas
- Windows/PowerShell: `npm.ps1` bloqueado por ExecutionPolicy → usar `npm.cmd` y `npx.cmd`.
- Auth.js v5 con credentials obliga a estrategia JWT (no database sessions) con Prisma adapter.
- `es-ES` no agrupa miles con 4 cifras (`1234,50 €`); sí a partir de 5 (`12.345,50 €`).
- npm 11 avisa de `unrs-resolver` con postinstall no aprobado; lint funciona igual.
- `.env` local creado desde `.env.example` (ignorado por git). `AUTH_SECRET` sigue siendo placeholder: generar uno real antes de implementar Auth.js.
