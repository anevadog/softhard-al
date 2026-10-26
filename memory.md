# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Fase 1 completada** y **Fase 2 completada** (catálogo, carrito, pedidos, stock y gestión).
- **Fase 3.1 completada** y **3.2a completada** (máquina de transiciones, cambio transaccional, historial y formulario del panel); siguiente: **3.2b** (asignación). Specs en `docs/specs/`; sin commit ni push en esta sesión.

## Stack y entorno
- Node 24.22.1 · Next 15.5.28 · React 19.1 · TS 5 · Tailwind v4 · Vitest 5 · Zod 4.6.7.
- Prisma 7.10.1 + adapter-pg · PostgreSQL 16.15 local (`localhost:5432`, BD `softhard`) · ESLint 9.
- Auth: next-auth 5.0.0-beta.32 + bcrypt coste 12. PowerShell: usar `npm.cmd`/`npx.cmd`.

## Autenticación y permisos
- `auth.config.ts` edge-safe; `auth.ts` Credentials. JWT 7 días; rol en token y revalidación en BD.
- `authz.ts`: `/app` cualquier sesión; `/admin` staff; `/trabajador` trabajador/encargado/admin.
- Middleware cubre `/app`, `/admin` y `/trabajador`; `requerirStaff()` y `requerirPersonalTaller()` revalidan rol.
- Registro siempre `cliente`; demo `@demo.local` / `Demo1234!`; callback interno validado.

## Solicitudes y panel
- Landing en `(public)`; copy en `site-content.ts`; validación Zod y capa de datos en `src/server/`.
- `/app/solicitudes` filtra por cliente; ajeno → 404; `/admin` redirige a `/admin/solicitudes`.
- Presupuesto: X/N de `Config`; X copiada en `diagnosticFee`; `finalAmount = presupuesto − X`; rechazo → `X`.
- Expiración perezosa al leer; sus transiciones ya generan historial. El panel usa la máquina de 3.2a con los 9 estados.

## Tienda, pedidos y stock
- `ProductCategory`; `price Decimal(10,2)`, `stock Int`, `imageUrl?`, `active` lógico; ficha solo activos.
- Carrito local `softhard-carrito-v1`; checkout revalida precio/stock y congela precios en `OrderItem`.
- `OrderStatus`; cancelación repone stock con movimientos; idempotencia y `updateMany` condicional.
- `StockMovement` es libro; `Product.stock = suma(variation)`; ajuste manual solo staff y en transacción.

## Fase 3.1 — taller
- `ServiceStatus` tiene 9 estados; `SERVICE_STATUSES_PANEL` se eliminó en 3.2a.
- Modelos nuevos: `ServiceStatusHistory`, `ServiceAssignmentHistory`, `WorkLog`, `RequestNote` (+ `RequestNoteType`).
- `ServiceRequest.lastActivityAt @default(now())`; backfill de filas existentes con `updatedAt`.
- `Config`: `inactiveRequestHours = 48`, `openWorkLogHours = 8`; seed solo declara defaults al crear, conserva `update: {}` y guarda local.
- `WorkLog`: índice parcial `work_logs_open_user_unique` y check `work_logs_end_after_start`, SQL manual.
- Migración `20261026145522_fase3_taller_datos` aplicada con `migrate deploy`; `migrate diff` → “No difference detected”.
- `/trabajador` con layout mobile-first y placeholder; enlaces desde `/app` y `/admin`.

## Fase 3.2a — transiciones
- Tabla normal por rol en `lib/service-status.ts`; trabajador limitado a su flujo (lista solo desde en_reparacion), staff corrige con motivo y entregada solo staff.
- Cambio transaccional (`updateMany` por estado; también assigneeId para trabajador) con historial, lastActivityAt y cierre de fichajes si el nuevo estado no es en_reparacion; presupuesto, decisión y expiración también historial. Formulario con 9 estados y motivo. Sin migración.

## Tests, QA y deuda
- **300 tests en 35 archivos**; `typecheck`, `lint` y `build` limpios.
- QA 3.1: índice → 23505; check fechas → 23514; rollback sin filas; backfill 1/1 solicitud igual a `updatedAt`.
- Deuda: pedidos pendientes retienen stock hasta cancelar; sin tests de integración con BD real; rate limiting/emails.
- Siguiente: 3.2b asignación (asignar, reasignar, tomar, devolver) e interfaz; no avanzar sin revisión.
- Aprendizajes: Prisma 7 exige driver adapter y `output`; Auth.js v5 requiere augmentar `@auth/core/jwt` y `next-auth/jwt`.
