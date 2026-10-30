# Spec Deuda previa a la Fase 4 — Caducidad de pedidos y tests del checkout

**Estado:** implementada en `47a0cb0`. Va antes de la Fase 4 y prepara la pasarela de pago (5.3),
que se apoya en estos mismos pedidos.

## Objetivo
Que un pedido que nadie paga no retenga stock para siempre, y que el checkout y
el ciclo de vida del pedido queden cubiertos por tests de integración contra
PostgreSQL real, igual que el taller en D4.

## Punto de partida
- El checkout crea el pedido en `pendiente`, congela los precios en `OrderItem`
  y descuenta el stock con movimientos `venta` en la misma transacción.
- `pagado` lo marca el staff a mano (todavía no hay pasarela). Transiciones en
  `lib/orders.ts`: pendiente → pagado | cancelado; pagado → entregado | cancelado.
- La cancelación repone el stock con movimientos `cancelacion_pedido`, es
  idempotente y usa `updateMany` condicional.
- Un pedido `pendiente` retiene su stock indefinidamente: es la deuda.

## DF1 — Caducidad de pedidos pendientes

### Reglas
- Parámetro nuevo en `Config`: `pendingOrderHours` (48 por defecto, decidido).
- `Order.expiresAt` se calcula y se guarda al crear el pedido (createdAt + N h),
  igual que el presupuesto: si N cambia, los pedidos existentes no cambian.
- Estado nuevo `caducado` en `OrderStatus`, final. Así el cliente y el panel lo
  distinguen de una cancelación. La única transición que lleva a él es
  pendiente → caducado, y solo la hace el sistema (nunca el staff ni el cliente).
- Motivo nuevo `caducidad_pedido` en `StockMovementReason`. La reposición crea un
  movimiento positivo por línea, con `userId` nulo (sistema) y `orderId` del
  pedido. Se mantiene el invariante `Product.stock = suma(variation)`.
- Un pedido caducado no se puede pagar ni reactivar. El cliente tiene que hacer
  otro pedido.

### Evaluación perezosa (sin cron, como los presupuestos)
- Función única `liberarPedidosCaducados()` en la capa de datos:
  - Selecciona como mucho 50 pedidos `pendiente` con `expiresAt <= ahora`, de
    más antiguo a más nuevo.
  - Para cada uno, en su propia transacción: `updateMany` condicional
    (`status = pendiente` y `expiresAt <= ahora`) a `caducado`. Solo si afecta a
    una fila crea los movimientos y actualiza el stock. Dos llamadas
    concurrentes nunca reponen dos veces.
- Se llama:
  - Al principio del checkout, antes de comprobar el stock, para que el stock
    liberado esté disponible para la compra.
  - En el catálogo público y la ficha de producto, para que no se muestre
    agotado lo que ya no está retenido.
  - En el listado y el detalle de pedidos del cliente y del panel.
  - Antes de que el staff cambie el estado de un pedido, para que no se pueda
    marcar `pagado` uno ya caducado.
- Si falla, no rompe la página que lo llama: se registra el error y la página se
  sirve igual. En el checkout sí aborta, porque ahí la coherencia del stock
  importa.

### Migración
- `ALTER TYPE` para añadir `caducado` y `caducidad_pedido`, columnas
  `orders.expires_at` y `orders.paid_at` (nullables) y columna
  `config.pending_order_hours`.
- Backfill en el SQL de la migración: los pedidos `pendiente` existentes reciben
  `expires_at = created_at + 48 h`. Los demás estados la dejan nula. Si alguno ya
  ha vencido, caduca en la primera lectura posterior a la migración.
- Índice `(status, expires_at)` para la consulta de caducados.
- Se genera con `--create-only`, se revisa el SQL y se aplica con
  `migrate deploy`.

### UI
- Etiqueta y color de `caducado` en `ORDER_STATUS_META`.
- El cliente ve en el detalle de su pedido pendiente "Caduca el …" (Europe/Madrid)
  y, si ha caducado, un texto que explica que el stock se ha liberado.
- Panel: filtro y recuento por estado con `caducado` incluido. Sin botones de
  acción en un pedido caducado.

### `Order.paidAt` (prepara el registro de cobros de 4.0 y el dashboard de 4.1)
- Columna nullable `orders.paid_at`. Por ahora se rellena en la misma
  transacción condicional del paso a `pagado` con el botón manual actual. En
  4.0 se le añaden `paidAmount`, `paymentMethod`, `paidById` y `paymentNote`, y el botón se
  sustituye por el componente "Registrar pago manual", que es común a pedidos y
  reparaciones. Pasar a `entregado` o a `cancelado` no la toca.
- Backfill en el SQL de la migración: los pedidos `pagado` y `entregado`
  existentes reciben `paid_at = updated_at`. Es una aproximación y queda
  documentada; los demás estados la dejan nula.
- Índice sobre `paid_at` para agregar por mes.

### Casos límite
- Un pedido caducado justo cuando el staff lo marca `pagado`: la transición es
  condicional y solo gana uno. Si gana la caducidad, el staff ve "El pedido ha
  caducado".
- La cancelación del cliente o del staff y la caducidad en carrera: solo una
  repone stock, porque ambas condicionan sobre `status = pendiente`.
- Producto archivado (`active = false`) en un pedido caducado: el stock se
  repone igualmente; el producto sigue sin mostrarse.
- Exactamente en `expiresAt`, el pedido caduca (`<=`). Se deja fijado con un test.

## DF2 — Tests de integración del checkout y del pedido
Se escriben en `*.int.test.ts` con el arnés de D4 (`enTransaccion`, rollback por
test).

### Casos
- Checkout correcto: crea el pedido con `expiresAt`, congela los precios,
  descuenta el stock y crea un movimiento `venta` por línea. El invariante del
  libro se cumple tras la operación.
- Stock insuficiente en una de varias líneas: no se escribe nada (ni pedido, ni
  movimientos, ni stock).
- Producto inactivo o inexistente en el carrito: se rechaza sin escrituras.
- Precio cambiado entre el carrito y el checkout: se usa el precio de la BD.
- Idempotencia: la misma `idempotencyKey` del mismo usuario devuelve el mismo
  pedido y no descuenta dos veces.
- Cancelación de un pedido pendiente y de uno pagado: repone el stock con
  `cancelacion_pedido`; una segunda cancelación no repone nada.
- Transiciones inválidas desde el panel (entregado → pagado, caducado → pagado,
  etc.): se rechazan sin escrituras.
- Caducidad: vencido → `caducado` con stock repuesto; no vencido → sin cambios;
  segunda llamada → sin efecto; el checkout libera el stock de un pedido vencido
  y lo usa.
- Propiedad: un cliente no ve ni cancela pedidos ajenos (`null` / 404).

- `paidAt`: se rellena al marcar `pagado` y no cambia al pasar a `entregado`.

### Concurrencia real (helper `sinRollback`)
El arnés de D4 ejecuta cada test dentro de una sola transacción, así que no
permite paralelismo real. Se añade en `src/test/integration/` un helper aparte:
- `sinRollback(fn)` abre un `PrismaClient` propio contra `softhard_test` (con la
  misma guarda `asegurarBdDeTest`) y deja que la capa de datos use transacciones
  reales, con varias conexiones del pool.
- Todo lo que crea el test lleva un prefijo único por ejecución (emails de
  usuario, nombres de producto). En `finally` se borra en orden de FK:
  movimientos → líneas → pedidos → productos → usuarios. Se borra solo lo que
  tiene ese prefijo; nunca se hace un `TRUNCATE` ni se toca el resto de la BD.
- Comprobación final: no quedan filas con el prefijo (0 residuos, como en QA).
- Los tests que lo usan van en un archivo propio (`*.concurrencia.int.test.ts`)
  que se ejecuta en serie respecto a los demás.
- Casos:
  - Dos checkouts simultáneos (`Promise.all`) por la última unidad: exactamente
    uno crea el pedido, el otro recibe "stock insuficiente" y el stock termina
    en 0, con un único movimiento `venta`.
  - Caducidad y cancelación simultáneas del mismo pedido: el stock se repone una
    sola vez.
  - Dos llamadas simultáneas a `liberarPedidosCaducados()`: un solo movimiento
    `caducidad_pedido` por línea.

## Relación con los tests del dashboard (Fase 4)
- Los ingresos se calculan sobre `Invoice` (`total` por `issuedAt`): las
  rectificativas restan en el mes de su emisión. Esta deuda no cambia por eso.
- Los tests de integración del dashboard **tienen que cubrir rectificativas
  restando en su mes** (mes distinto del de la original, y mismo mes con
  compensación). Las facturas no existen hasta 4.3, así que esos tests se
  escriben en 4.1 (ver los criterios de `fase-4.md`), no aquí.
- Lo que se hace aquí y luego reutilizan:
  - el helper `sinRollback`;
  - fábricas de datos de prueba (cliente, producto con stock, pedido) en
    `src/test/integration/`, pensadas para extenderse con cobros y facturas;
  - `Order.paidAt`, que 4.0 completa con `paidAmount`, método, autor y nota.

## Criterios de aceptación
- Ningún pedido `pendiente` vencido retiene stock después de la primera lectura
  que lo evalúa.
- El invariante `Product.stock = suma(variation)` se cumple en todos los tests de
  integración del pedido.
- Unitarios de las funciones puras nuevas (`expiresAt`, transiciones con
  `caducado`).
- `typecheck`, `lint`, `test` y `test:integration` limpios. El `build` solo tras
  comprobar que `DATABASE_URL` es local.
- `memory.md` actualizado.

## Fuera de alcance
- Pago real o simulado (5.3).
- Avisar al cliente por email de que su pedido va a caducar (5.2 solo cubre tres
  eventos).
- Reservas de stock separadas del stock disponible: se sigue descontando al
  crear el pedido.

## Decisiones tomadas
- `pendingOrderHours = 48` por defecto.
- `caducado` es un estado propio y no se reutiliza `cancelado`. `caducado` lo
  pone el sistema por impago; `cancelado` es una decisión humana (cliente o
  staff). Se distinguen en el dashboard, los reportes y los CSV.
- `Order.paidAt` se añade aquí (no en 4.1), con backfill desde `updatedAt`.
- Helper de concurrencia real aprobado, con limpieza por prefijo y 0 residuos.

Sin dudas abiertas. Spec cerrada y lista para implementar.
