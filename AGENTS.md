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
- `src/components/` UI reutilizable
- `src/lib/` db, auth, utilidades
- `src/server/` server actions y queries
- `prisma/` esquema y migraciones
- `docs/specs/` specs por fase

## Comandos
- `npm run dev` desarrollo
- `npm run build` build
- `npm run lint` lint
- `npm run test` vitest
- `npx prisma migrate dev` migración
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
- No borrar archivos ni migraciones sin permiso.
- No modificar `.env` ni secretos.
- Tareas grandes: primero plan (archivos, pasos, casos límite, dudas), luego build.
- Actualizar `memory.md` al terminar cada tarea.

## Fuera de alcance Fase 1
Pagos reales, e-commerce completo, tickets internos, contabilidad, facturación, notificaciones email.