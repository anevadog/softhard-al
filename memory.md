# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Fase 1**, **Fase 2**, **3.1**, **3.2a**, **3.2b** y **3.3** cerradas con commit (3.3 en `439be14`, ajuste del detalle libre en `9706f57`). Specs en `docs/specs/`.
- Documentación al día con la Fase 3 en `0b1d7c3` (README, AGENTS.md, fase-1.md, comentarios del esquema). Siguiente: **3.4** fichaje (plan antes de construir).

## Stack y entorno
- Node 24.22.1 · Next 15.5.28 · React 19.1 · TS 5 · Tailwind v4 · Vitest 5 · Zod 4.6.7.
- Prisma 7.10.1 + adapter-pg · PostgreSQL 16.15 local (`localhost:5432`, BD `softhard`) · ESLint 9.
- Auth: next-auth 5.0.0-beta.32 + bcrypt coste 12. Git Bash: `npm`/`npx` normales. `npm run build` ejecuta `migrate deploy`.

## Autenticación y permisos
- `auth.config.ts` edge-safe; `auth.ts` Credentials. JWT 7 días; rol en token y revalidación en BD.
- `authz.ts`: `/app` cualquier sesión; `/admin` staff; `/trabajador` trabajador/encargado/admin.
- Middleware cubre `/app`, `/admin` y `/trabajador`; `requerirStaff()` y `requerirPersonalTaller()` revalidan rol.
- Registro siempre `cliente`; demo `@demo.local` / `Demo1234!` (incluye `trabajador@demo.local`); callback interno validado.

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

## Fase 3.1 / 3.2 — datos, transiciones y asignación
- 9 estados; `ServiceStatusHistory`, `ServiceAssignmentHistory`, `WorkLog`, `RequestNote`; `lastActivityAt`; `Config.inactiveRequestHours = 48`, `openWorkLogHours = 8`.
- `WorkLog`: índice parcial `work_logs_open_user_unique` y check `work_logs_end_after_start` (SQL manual, migración `20261026145522_fase3_taller_datos`).
- Flujo por rol en `lib/service-status.ts`; cambios condicionales con historial, `lastActivityAt` y cierre de fichajes.
- Asignar/reasignar solo staff; tomar solo aceptada sin responsable (`updateMany` condicional); devolver exige motivo, conserva estado y cierra fichaje.

## Fase 3.3 — panel del trabajador
- `/trabajador`: mis reparaciones agrupadas (aceptada → en_reparacion → esperando_repuesto → lista, más antigua primero) y "Para tomar" (máx. 50) solo para trabajador; staff ve enlace al panel.
- `/trabajador/reparaciones/[id]`: secciones Equipo y avería, Visita, Acciones, Historial de estados y de asignaciones (3.4/3.5 se insertan antes de los historiales). Staff → redirect al detalle admin.
- Datos en `server/data/worker-requests.ts` con filtro en el `where`; ajena/inexistente → 404; libre → solo lectura con "Tomar", con consulta propia sin historiales ni cliente (tipo unión por `esMia`). Sin email/teléfono.
- Botones de estado desde `accionesEstadoTrabajador` (`lib/worker-requests.ts`), sin correcciones. Tomar y cambiar estado redirigen al detalle.
- Componentes en `components/taller/` con `onSubmit` + `useTransition`.

## Tests, QA y deuda
- **349 tests en 39 archivos** (contados con el reporter JSON de Vitest); `typecheck`, `lint` y `build` limpios en 3.3.
- QA 3.3 con rollback y 0 residuos (19 comprobaciones de visibilidad por trabajador); navegador: inicio de trabajador y encargado, 404 ajena e inexistente, redirect del staff.
- Deuda: sin campo de dirección (domicilio); `StatusForm`/`AssignmentForm` usan `useActionState`; detalle admin sin historial de estados (3.7); test de `cerrarFichajesAbiertosEnTx` en 3.4; pedidos pendientes retienen stock; sin tests de integración con BD real; rate limiting/emails.
- Aprendizajes: Prisma 7 exige driver adapter y `output`; Auth.js v5 requiere augmentar `@auth/core/jwt` y `next-auth/jwt`.
