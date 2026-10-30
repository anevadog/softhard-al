# AGENTS.md — SoftHard A&L

## Proyecto
Web de servicios técnicos (reparación de ordenadores, impresoras, portátiles) y venta de productos.
Proyecto de portfolio del dueño. Repo privado. Datos ficticios en demo.

## Stack
- Next.js 15 (App Router) + TypeScript estricto
- Tailwind CSS
- Prisma + PostgreSQL (Docker local)
- Auth.js v5 (JWT) + bcrypt
- Zod para validación
- Vitest para tests

## Estructura
- `src/app/(public)/` landing y páginas públicas
- `src/app/(auth)/` login y registro
- `src/app/app/` área cliente autenticado
- `src/app/admin/` panel interno (encargado/admin)
- `src/app/trabajador/` área de taller (trabajador/encargado/admin), mobile-first
- `src/app/api/auth/` handler de Auth.js
- `src/middleware.ts` protección de `/app`, `/admin` y `/trabajador` por rol
- `src/components/` UI reutilizable (`admin/`, `taller/`, `service-requests/`, `site/`, `cart/`, `orders/`; `payments/` previsto en 4.0 para "Registrar pago manual")
- `src/lib/` db, auth, permisos (`authz.ts`), reglas puras (estados, importes, stock, fichajes, notas, avisos y reportes), formato de fechas en Europe/Madrid y `validations/`
- `src/server/authorization.ts` guards `requerirStaff` y `requerirPersonalTaller` (revalidan el rol en BD)
- `src/server/actions/` Server Actions
- `src/server/data/` consultas y escrituras con control de propiedad
- `src/generated/` cliente de Prisma generado (no versionado)
- `prisma/` esquema, migraciones y seed
- `docs/specs/` specs por fase (`fase-1.md`, `fase-2.md`, `fase-3.md`, `deuda-fase4.md`, `fase-4.md`, `fase-5.md`)

## Comandos
- `npm run dev` desarrollo
- `npm run build` build
- `npm run lint` lint
- `npm run typecheck` comprobación de tipos
- `npm run test` vitest (unitarios, sin BD)
- `npm run test:integration` tests `*.int.test.ts` contra la base local `<base>_test` (con rollback)
- `npx prisma migrate dev --create-only --name <nombre>` genera la migración sin aplicarla
- `npx prisma migrate deploy` aplica las migraciones pendientes (tras revisar el SQL)
- `npx prisma validate` valida el esquema
- `npx prisma studio` ver BD
- `docker compose up -d` Postgres local

## Convenciones
- Server Components por defecto. Client solo si hace falta.
- Server Actions para mutaciones. Validación Zod en servidor.
- `camelCase` variables, `PascalCase` componentes, `kebab-case` rutas.
- Commits en español: `feat(scope): mensaje`.

## Reglas
- Permisos SIEMPRE en servidor (middleware + checks en actions). La UI no es seguridad.
- Contraseñas con bcrypt. Nunca texto plano.
- No instalar dependencias sin justificar.
- No ejecutar `git commit` ni `git push` sin permiso explícito.
- Commits y PRs sin atribución a la IA: nada de `Co-Authored-By`, "Generated with Claude Code" ni menciones a Claude o a otros asistentes. El autor es solo el dueño del repo.
- No borrar archivos ni migraciones sin permiso.
- Migraciones: generarlas con `--create-only`, revisar el SQL antes de aplicarlo y aplicarlas con `prisma migrate deploy`. Nunca modificar migraciones antiguas. Nada que reinicie o borre la BD sin permiso.
- `npm run build` ejecuta `prisma migrate deploy`: comprobar antes que `DATABASE_URL` es local.
- No modificar `.env` ni secretos.
- Tareas grandes: primero plan (archivos, pasos, casos límite, dudas), luego build.
- Actualizar `memory.md` al terminar cada tarea.

## Fuera de alcance Fase 1
Pagos reales, e-commerce completo, tickets internos, contabilidad, facturación, notificaciones email.