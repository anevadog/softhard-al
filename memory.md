# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Fase 1 completada (tareas 1–8)**.
- **Fase 2 completada (tareas 1–7)**: catálogo, ficha, carrito, checkout/pedidos, libro de stock, edición/ajustes y gestión de pedidos.
- `main` con 4 commits locales pendientes de push; cambios de 6A, 6B y 7 sin commit. Specs en `docs/specs/`.

## Stack efectivo
- Node 24.22.1 LTS · Next 15.5.28 · React 19.1 · TS 5 · Tailwind v4 · Vitest 5 · Zod 4.6.7
- Prisma 7.10.1 + adapter-pg · PostgreSQL 16.15 nativo (winget) · ESLint 9
- Auth: next-auth 5.0.0-beta.32 (beta) + bcrypt 6 nativo (coste 12)

## Entorno local
- PowerShell: `npm.ps1` bloqueado → `npm.cmd`/`npx.cmd`; Postgres 16:5432, `postgres`/`postgres`, BD `softhard`; Prisma 7 carga `.env` vía `prisma.config.ts`.

## Autenticación
- `auth.config.ts` edge-safe; `auth.ts` añade Credentials. JWT 7 días; rol en token y `/admin` **revalida en BD**.
- `authz.ts`: `/app` cualquier sesión, `/admin` solo staff; middleware + layouts. Registro siempre `cliente`; demo `@demo.local` / `Demo1234!`.
- `navigation.ts` valida callback interno; rechaza URLs externas y el panel para clientes.

## Solicitudes y panel
- Landing en `(public)`; copy en `src/lib/site-content.ts`; validación Zod, datos y acciones en `src/lib/validations/` y `src/server/`.
- `/app/solicitudes` filtra por cliente; `/admin` redirige a `/admin/solicitudes`; `requerirStaff()` revalida rol en BD.
- Presupuesto: X e N de `Config`; X copiada en `diagnosticFee`; `finalAmount = presupuesto − X`; rechazo → `X`; expiración perezosa.

## Productos, carrito y pedidos
- Enum `ProductCategory`; `price Decimal(10,2)`, `stock Int`, `imageUrl` opcional y `active` lógico; `/productos/[id]` solo activos.
- Carrito local `softhard-carrito-v1`: solo IDs/cantidades, revalidación de precio/stock, contador y checkout autenticado.
- `OrderStatus`: `pendiente`, `pagado`, `entregado`, `cancelado`; `crearPedidoCliente` congela precios, total `Decimal(10,2)`, `updateMany` condicional e idempotencia UUID.
- `/app/pedidos` filtra `userId`; ajeno → 404. Checkout descuenta stock; el pendiente lo retiene hasta cancelarse.

## Libro de stock (6A/6B)
- `StockMovementReason`: `stock_inicial`, `venta`, `cancelacion_pedido`, `reposicion`, `ajuste`; `variation` entero ≠ 0 y signo coherente.
- Invariante: `Product.stock = suma de StockMovement.variation`; `productId Restrict`, `orderId`/`userId` `SetNull`.
- Alta fija stock inicial; edición no toca stock. Ajuste manual solo staff: reposición >0, ajuste ± con nota, máximo 10.000, `updateMany` condicional sin negativos y movimiento en transacción.
- Historial de 10 movimientos en ficha con usuario/Sistema, pedido abreviado y enlace a `/admin/pedidos/[id]`.

## Gestión de pedidos (7)
- `/admin/pedidos` con filtro/contadores; detalle con cliente, líneas congeladas y total; inexistente → 404.
- Transición pura: `pendiente → pagado | cancelado`, `pagado → entregado | cancelado`; finales `entregado`/`cancelado`; `updateMany` condicional contra carreras.
- Cancelación: actualiza estado, luego lee líneas y repone todas (archivadas incluidas) con movimiento positivo por línea; segunda cancelación no repone; pagado exige motivo y aviso de no reembolso.

## Tests, QA y deuda
- **258 tests** en 29 archivos; `typecheck`, `lint`, `build` limpios.
- QA 6B: reposición 19→21, ajuste -1→20, rechazo -10.000 sin cambio; consistencia 0 filas.
- QA 7: pedido A pagado; pedido B 8→6→8 al cancelar; segunda cancelación sin cambio; consistencia 0 filas.
- Deuda: pedidos pendientes retienen stock hasta cancelar; sin tests de integración con BD real; rate limiting y emails pendientes.
- Aprendizajes: Prisma 7 exige driver adapter y `output`; Auth.js v5 requiere augmentar `@auth/core/jwt` y `next-auth/jwt`.
