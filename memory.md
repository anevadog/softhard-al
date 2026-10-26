# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Fase 1 completada (tareas 1–8)**.
- **Fase 2, tareas 1–5 completadas**: CRUD `/admin/productos`, catálogo `/productos`, carrito local `/carrito`, checkout/pedidos y ficha pública.
- Push final completado; `main` sincronizado con `origin/main`. Siguiente: stock administrativo con libro de movimientos (Tarea 6). Specs en `docs/specs/fase-1.md` y `fase-2.md`.

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
- `navigation.ts` valida callback interno tras login/registro; rechaza URLs externas y el panel para clientes.

## Solicitudes y panel
- Landing en `(public)`; copy en `src/lib/site-content.ts`; validación Zod, datos y acciones en `src/lib/validations/` y `src/server/`.
- `clientId` sale de la sesión; Zod descarta campos inyectados. Formulario controlado con `onSubmit` + `useTransition`.
- `/app/solicitudes` filtra por cliente; `/admin` redirige a `/admin/solicitudes`; `requerirStaff()` revalida rol en BD.
- Presupuesto: X e N de `Config`; X copiada en `diagnosticFee`; `finalAmount = presupuesto − X`; rechazo → `X`.
- Un presupuesto por solicitud; importes en céntimos; expiración perezosa sin cron.

## Productos y carrito
- Enum fijo `ProductCategory`; `price Decimal(10,2)`, `stock Int`, `imageUrl` opcional y `active` lógico; datos/acciones con `requerirStaff()`.
- Catálogo público filtra `active`, ordena `createdAt desc`, acepta categoría; filtros por URL en `src/lib/catalog.ts`.
- Ficha `/productos/[id]`: solo activos, 404 si no existe/archivado; conserva `?categoria`, `<img>` y botón de carrito reutilizado.
- Stock: 0 = «Agotado»; 1–3 avisan; ≥4 indican unidades. Seed idempotente con 6 productos (uno agotado).
- Carrito local `softhard-carrito-v1`: solo IDs/cantidades, contador, total en céntimos, revalidación de precios/stock y ajuste con aviso.
- Formulario de producto: precio coma/punto, URL http(s) o `null`, placeholder; borrado lógico.

## Pedidos
- `OrderStatus`: `pendiente`, `pagado`, `entregado`, `cancelado`; los pedidos nuevos nacen `pendiente`.
- `crearPedidoCliente`: precios congelados en `OrderItem`, total `Decimal(10,2)`, transacción con `updateMany` condicional por producto ordenado por id; si falla, rollback completo.
- `idempotencyKey` UUID único por usuario: doble clic/reintento devuelve el pedido existente. Carrito se vacía solo tras éxito.
- `/app/pedidos` historial y `/app/pedidos/[id]` detalle/éxito; filtran `userId`, pedido ajeno → 404. Visitante → `/login?callbackUrl=/carrito`.
- Sin pasarela de pago ni panel admin de pedidos en esta tarea.

## Tests y próximos pasos
- **198 tests** en 23 archivos; `typecheck`, `lint` y `build` limpios. QA manual: checkout/stock e historial; ficha válida, filtro, agotado, 404 e id largo.
- [x] Fase 1 y Fase 2 tareas 1–5; push final completado. Seed solo con host local o `SEED_ALLOW_PRODUCTION=true`; AGENTS corregido.
- [ ] Siguiente: Tarea 6, stock administrativo con libro de movimientos.
- [ ] Deuda: rate limiting en login, emails y tests de integración con BD.
- Aprendizajes: Prisma 7 exige driver adapter y `output`; `migrate dev` puede no regenerar el cliente. Auth.js v5 requiere augmentar `@auth/core/jwt` y `next-auth/jwt`.
