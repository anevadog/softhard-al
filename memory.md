# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea.

## Estado actual
- **Fases 1, 2 y 3 completas** (`255f814`, con push). **Fase de deuda D1–D5 hecha**; D5 (vuelta con filtros en `/admin/fichajes` vía `rutaVueltaFichajes` en `lib/navigation.ts`) cerrada con commit `fix(fichajes)`. D1–D5 sin push.
- **D4** en `4b3a551`: `npm run test:integration` (13 tests en `*.int.test.ts`) contra `softhard_test` (creada vacía con permiso; migrada en el global setup), rollback por test con `src/test/integration/db.ts`. **D3** en `2f19e51`: `ServiceRequest.address` (migración `20261028170425_direccion_domicilio` aplicada; `migrate diff` vacío), obligatoria en domicilio (5–200), nula en taller; visible al cliente, en el panel y al trabajador solo en sus reparaciones. **D2** en `6dd7f11`: los 8 formularios pasan a `onSubmit` + `useTransition` (sin `useActionState` en el proyecto). **D1** cerrada con commit `578f5bb`: migración `20261028165149_rate_limit_login` aplicada con `migrate deploy`; `migrate diff` vacío.

## Stack y entorno
- Node 24.22.1 · Next 15.5.28 · React 19.1 · TS 5 · Tailwind v4 · Vitest 5 · Zod 4.6.7 · Prisma 7.10.1 + adapter-pg · PostgreSQL 16.15 local (`localhost:5432`, BD `softhard`) · ESLint 9. Auth: next-auth 5.0.0-beta.32 + bcrypt coste 12. Git Bash: `npm`/`npx` normales. `npm run build` ejecuta `migrate deploy`.

## Autenticación y permisos
- `auth.config.ts` edge-safe; `auth.ts` Credentials. JWT 7 días; rol en token y revalidación en BD. `authz.ts`: `/app` cualquier sesión; `/admin` staff; `/trabajador` trabajador/encargado/admin. Middleware cubre `/app`, `/admin` y `/trabajador`; `requerirStaff()` y `requerirPersonalTaller()` revalidan rol. Registro siempre `cliente`; demo `@demo.local` / `Demo1234!` (incluye `trabajador@demo.local`); callback interno validado.

## Solicitudes y panel
- Landing en `(public)`; copy en `site-content.ts`. `/app/solicitudes` filtra por cliente; ajeno → 404; `/admin` redirige a `/admin/solicitudes`. Presupuesto: X/N de `Config`; X copiada en `diagnosticFee`; `finalAmount = presupuesto − X`; rechazo → `X`. Expiración perezosa al leer; sus transiciones ya generan historial. El panel usa la máquina de 3.2a con los 9 estados.

## Tienda, pedidos y stock
- `ProductCategory`; `price Decimal(10,2)`, `stock Int`, `imageUrl?`, `active` lógico; ficha solo activos. Carrito local `softhard-carrito-v1`; checkout revalida precio/stock y congela precios en `OrderItem`. `OrderStatus`; cancelación repone stock con movimientos; idempotencia y `updateMany` condicional. `StockMovement` es libro; `Product.stock = suma(variation)`; ajuste manual solo staff y en transacción.

## Fase 3.1 / 3.2 — datos, transiciones y asignación
- 9 estados; `ServiceStatusHistory`, `ServiceAssignmentHistory`, `WorkLog`, `RequestNote`; `lastActivityAt`; `Config.inactiveRequestHours = 48`, `openWorkLogHours = 8`. `WorkLog`: índice parcial `work_logs_open_user_unique` y check `work_logs_end_after_start` (SQL manual, migración `20261026145522_fase3_taller_datos`). Flujo por rol en `lib/service-status.ts`; cambios condicionales con historial, `lastActivityAt` y cierre de fichajes. Asignar/reasignar solo staff; tomar solo aceptada sin responsable y nunca devuelta (`updateMany` condicional); devolver exige motivo, conserva estado y cierra fichaje.

## Fase 3.3 — panel del trabajador
- `/trabajador`: mis reparaciones agrupadas (aceptada → en_reparacion → esperando_repuesto → lista, más antigua primero) y "Para tomar" (máx. 50) solo para trabajador; staff ve enlace al panel. `/trabajador/reparaciones/[id]`: secciones Equipo y avería, Visita, Acciones, Historial de estados y de asignaciones (Fichajes de 3.4 y Notas de 3.5 van antes de los historiales). Staff → redirect al detalle admin.
- Datos en `server/data/worker-requests.ts` con filtro en el `where`; ajena/inexistente → 404; libre → solo lectura con "Tomar", con consulta propia sin historiales ni cliente (tipo unión por `esMia`). Sin email/teléfono. Botones de estado desde `accionesEstadoTrabajador` (`lib/worker-requests.ts`), sin correcciones. Tomar y cambiar estado redirigen al detalle. Componentes en `components/taller/` con `onSubmit` + `useTransition`.

## Fase 3.4 — fichaje
- Puras en `lib/work-logs.ts` (duración, aviso >N h, semanas lunes–lunes y `datetime-local` en Europe/Madrid sin dependencias); Zod en `validations/work-logs.ts`. Datos en `server/data/work-logs.ts`: entrada en reparación con `updateMany` condicional previo (bloquea la fila y ordena carreras con cambios de estado); `P2002` del índice parcial → "ya-abierto"; salida/cierre con `endedAt: null`; corrección staff guarda solo último editor, no reabre ni cierra. Toda acción ligada actualiza `lastActivityAt`.
- Solo rol trabajador ficha. UI: tarjeta en `/trabajador`, sección Fichajes en el detalle propio, `/trabajador/fichajes?semana=`, `/admin/fichajes` (abiertos, cerrar, corregir) y sección en el detalle admin. `format.ts` usa `timeZone: Europe/Madrid`.

## Fase 3.5 — notas y falta de repuesto
- `server/data/request-notes.ts`: trabajador solo en su reparación no final (`updateMany` condicional previo + `lastActivityAt`); staff en cualquiera; atender solo staff y solo `falta_repuesto` pendiente (condicional). Notas inmutables; la falta no cambia el estado. UI: sección Notas en el detalle propio (antes de historiales) y en el detalle admin con "Marcar atendida"; listado admin con etiqueta por fila (`_count` filtrado) y aviso con el total. Test fija que las consultas del cliente no seleccionan notas.

## Fase 3.6 — avisos sin actividad
- `lib/inactivity.ts` (límite estricto: exactamente en el plazo no avisa) y `server/data/inactivity.ts` con filtros en la consulta, tope 20 y total. Trabajador: aceptada/en_reparacion/esperando_repuesto; panel: también lista, con o sin responsable.
- Devuelta = sin responsable, no final y con entrada de historial `toAssigneeId` nulo. `WHERE_PARA_TOMAR` (en `worker-requests.ts`) excluye devueltas en "Para tomar", en la toma y en el detalle libre. Aviso en cada página de `/trabajador` (no en el layout) y bloque "Requieren atención" en `/admin/solicitudes`.

## Fase 3.7 — vistas y reportes del encargado
- `lib/reports.ts` (horas por trabajador con 0 incluidos; por reparación con acumulado) y `server/data/reports.ts`; un fichaje cuenta entero en su semana de inicio. `WeekNav` reutilizable. `/admin/reportes` (4 secciones, avisos sin tope), `/admin/fichajes` con lista semanal filtrable por trabajador, historial de estados en el detalle admin, filtro `?repuesto=1` y "Ver todas" desde "Requieren atención".

## Deuda D1 — límite de intentos de login
- `LoginAttempt` (email normalizado, ip?, success; sin relación con `User`). Política pura en `lib/login-rate-limit.ts`: 5 fallos por email o 20 por IP en 15 min; limpieza perezosa >24 h en la misma transacción del registro.
- `authorize` en `lib/credentials.ts` (no en la acción: el endpoint de Auth.js es público); bloqueado lanza `DemasiadosIntentos` (`CredentialsSignin`, código `rate_limited`) y la acción lo traduce. Tests mockean `next-auth` (no carga en Vitest).

## Tests, QA y deuda
- **492 tests unitarios en 56 archivos + 13 de integración**; `typecheck`, `lint` y `build` limpios en D5.
- QA 3.3–3.7 y D1 con rollback y 0 residuos (scripts en el scratchpad). Navegador solo vistas sin escritura.
- Deuda: correcciones de fichaje sin historial completo y sin control de solapes; pedidos pendientes retienen stock; checkout y pedidos sin tests de integración; emails; capturas del README sin el taller (manual).
- Aprendizajes: Prisma 7 exige driver adapter y `output`; Auth.js v5 requiere augmentar `@auth/core/jwt` y `next-auth/jwt`.
