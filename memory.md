# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Fase 1 completada (tareas 1–8)**.
- **Fase 2, tareas 1–2 completadas**: CRUD en `/admin/productos` y catálogo público `/productos` con filtros y stock.
- Siguiente: ficha de producto y carrito. Specs en `docs/specs/fase-1.md` y `fase-2.md`.

## Stack efectivo
- Node 24.22.1 LTS · Next 15.5.28 · React 19.1 · TS 5 · Tailwind v4 · Vitest 5 · Zod 4.6.7
- Prisma 7.10.1 + adapter-pg · PostgreSQL 16.15 nativo (winget) · ESLint 9
- Auth: next-auth 5.0.0-beta.32 (beta) + bcrypt 6 nativo (coste 12)

## Entorno local
- PowerShell: `npm.ps1` bloqueado → `npm.cmd`/`npx.cmd`; Postgres 16:5432, `postgres`/`postgres`, BD `softhard`; Prisma 7 carga `.env` vía `prisma.config.ts`.

## Autenticación
- `auth.config.ts` edge-safe; `auth.ts` añade Credentials. JWT 7 días; rol en token y `/admin` **revalida en BD**.
- `authz.ts` decide (`puedeAcceder`): `/app` cualquier sesión, `/admin` solo staff; middleware + layouts.
- Registro público siempre `cliente`; bcrypt ≤ 72 bytes; demo `@demo.local` con `Demo1234!`.

## Solicitudes y panel
- Landing en `(public)`; copy en `src/lib/site-content.ts`; validación Zod, datos y acciones en `src/lib/validations/` y `src/server/`.
- `clientId` sale de la sesión; Zod descarta campos inyectados. Formulario controlado con `onSubmit` + `useTransition`.
- `/app/solicitudes` filtra por cliente; `/admin` redirige a `/admin/solicitudes`; `requerirStaff()` revalida rol en BD.
- Presupuesto: X e N de `Config`; X copiada en `diagnosticFee`; `finalAmount = presupuesto − X`; rechazo → `X`.
- Un presupuesto por solicitud; importes en céntimos y guardados como cadena.
- Cliente decide si está `pendiente`, la solicitud sigue abierta y no venció; expiración perezosa sin cron.

## Productos
- Enum fijo `ProductCategory`; `price Decimal(10,2)`, `stock Int`, `imageUrl` opcional y `active` lógico; datos y acciones con `requerirStaff()` en `src/server/`.
- Catálogo público: `listarProductosPublicos` filtra `active`, ordena `createdAt desc` y acepta categoría; filtros por URL en `src/lib/catalog.ts`.
- Stock: 0 = «Agotado» y botón deshabilitado; 1–3 avisan; ≥4 indican unidades. Carrito real pendiente.
- Formulario: precio coma/punto, URL http(s) o `null`, placeholder; seed idempotente con 6 productos (uno agotado).
- Tests: **127** en 13 archivos (14 validación, 11 acciones y 8 de catálogo nuevos).

## Decisiones
- Roles: cliente, trabajador, encargado, admin. En Fase 1 `admin` = `encargado`.
- Pagos simulados, datos ficticios; `build` sin Turbopack (`dev` con Turbopack); tema claro fijo.

## Próximos pasos
- [x] Fase 1 completa (tareas 1–8) y README.
- [x] Fase 2, tarea 1: catálogo interno de productos.
- [x] Fase 2, tarea 2: catálogo público, filtros y estados de stock.
- [ ] Fase 2: detalle de producto, carrito y pedidos.
- [ ] Deuda: rate limiting en login, emails y tests de integración.

## Aprendizajes / notas
- Prisma 7: driver adapter y `output` obligatorios; `migrate dev` puede no regenerar el cliente. Auth.js v5: augmentar `@auth/core/jwt` y `next-auth/jwt`.
