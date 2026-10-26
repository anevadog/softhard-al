# Spec Fase 2 — Catálogo, carrito y pedidos

## Objetivo

Construir el flujo de compra de la tienda: catálogo público, ficha de producto,
gestión interna de productos y stock, carrito local, checkout transaccional,
historial de pedidos, página de éxito y gestión administrativa de pedidos. La fase
incluye el libro de movimientos de stock como fuente de verdad del stock.

## Alcance de la Tarea 1

- Modelo `Product` con categoría, precio, stock, imagen y borrado lógico.
- Migración de base de datos.
- Panel `/admin/productos` con listado, creación, edición y borrado.
- Acceso exclusivo para `encargado` y `admin`.
- Validación Zod en servidor.
- Tests de validación y de las acciones de crear/editar.
- Productos de demostración en el seed.

## Alcance de la Tarea 2

- Página pública `/productos`, accesible sin iniciar sesión.
- Tarjetas con imagen, nombre, categoría, precio y disponibilidad.
- Filtros por categoría mediante URL: todos, ordenadores, portátiles, impresoras,
  accesorios y consumibles.
- Producto sin stock marcado como «Agotado» y botón de compra deshabilitado.
- Botón «Añadir al carrito» preparado para conectarse al carrito en la Tarea 3.
- Enlaces al catálogo desde la cabecera y el hero de la landing.
- Producto de demostración agotado para visualizar el estado.

## Alcance de la Tarea 3

- Carrito accesible desde `/carrito` y desde el icono de la cabecera.
- Persistencia en LocalStorage con clave versionada `softhard-carrito-v1`.
- Solo se guardan `productId` y `quantity`; nunca precios ni copias del producto.
- Contador de unidades totales en la cabecera, con `99+` por encima de 99.
- Añadir desde el catálogo con confirmación temporal y límite de stock.
- Líneas con precio unitario, control `+`/`-`, subtotal y total.
- Eliminación de líneas y estado vacío con enlace al catálogo.
- Revalidación de precios, stock y disponibilidad con una Server Action pública.
- Productos inexistentes, inactivos o sin stock se retiran; las cantidades
  superiores al stock se ajustan con aviso.
- Botón «Finalizar compra» deshabilitado; el checkout no entra en esta tarea.

## Alcance de la Tarea 4

- Checkout desde `/carrito` para usuarios autenticados.
- Los visitantes van a `/login?callbackUrl=/carrito`; el callback se conserva
  también al pasar por el registro y se descarta si no es una ruta interna.
- Creación de `Order` y `OrderItem` con precio unitario congelado y total calculado
  en servidor.
- Descuento de stock atómico mediante una transacción con actualizaciones
  condicionales; si una línea no tiene stock, se revierte el pedido completo.
- Clave de idempotencia UUID por usuario para que un doble clic o un reintento de
  red devuelva el pedido ya creado, no uno nuevo.
- Carrito vaciado solo después de crear el pedido.
- Página de éxito y detalle en `/app/pedidos/[id]` y historial en `/app/pedidos`.
- Consultas filtradas por propietario: un pedido ajeno devuelve 404.
- Estado inicial `pendiente`; el resto del enum queda preparado para la gestión
  administrativa posterior.
- Sin pasarela de pago y sin panel de administración de pedidos en esta tarea.

## Alcance de la Tarea 5

- Ficha pública `/productos/[id]` para productos activos.
- Imagen, descripción, precio, disponibilidad y acceso al carrito.
- Producto inexistente o archivado devuelve 404.
- Enlace de vuelta al catálogo conservando la categoría cuando corresponda.

## Alcance de la Tarea 6A

- Enum y modelo `StockMovement` con `variation`, `reason`, `orderId`, `userId`,
  `note` y `createdAt`.
- Restricciones: variación distinta de cero y signo coherente con el motivo.
- Backfill `stock_inicial` para todos los productos con stock mayor que cero,
  incluidos los archivados.
- Checkout y alta de producto crean sus movimientos en la misma transacción.
- Seed idempotente: solo crea `stock_inicial` al crear el producto.
- Consulta de consistencia `Product.stock = suma de movimientos`.

## Alcance de la Tarea 6B

- Alta con stock inicial; edición sin campo de stock, aunque se inyecte en la
  petición.
- Stock visible como dato de solo lectura en la edición.
- Ajuste manual solo para `encargado` y `admin`, con motivo, variación y nota.
- Reposición positiva; ajuste con signo y nota obligatoria; máximo de 10.000
  unidades por movimiento.
- Vista previa «stock actual → stock resultante» y botón deshabilitado al enviar.
- Actualización condicional en transacción para impedir stock negativo y guardar el
  movimiento con el usuario.
- Historial de los últimos 10 movimientos en la ficha del producto.

## Alcance de la Tarea 7

- `/admin/pedidos` con filtro por estado, contadores, cliente, fecha, total y estado.
- Detalle `/admin/pedidos/[id]` con cliente, líneas a precio congelado y total;
  pedido inexistente devuelve 404.
- Transiciones puras `pendiente → pagado | cancelado` y
  `pagado → entregado | cancelado`; `entregado` y `cancelado` son finales.
- Actualización condicional sobre el estado esperado para resolver carreras y dobles
  clics; la petición perdedora recibe un mensaje claro.
- Cancelación transaccional con reposición de todas las líneas, incluidas las
  archivadas, y un movimiento `cancelacion_pedido` positivo por línea.
- Motivo obligatorio y aviso de no reembolso al cancelar un pedido pagado.
- Enlace desde el historial de stock al detalle del pedido.
- Sin historial de estados del pedido ni tests de integración con base de datos real.

## Actores

- **Encargado / admin**: gestiona catálogo, stock, pedidos y solicitudes desde el
  panel.
- **Cliente / trabajador**: sin acceso al panel interno; puede comprar y consultar
  sus propios pedidos.
- **Visitante**: consulta el catálogo y usa el carrito local, pero debe iniciar
  sesión para finalizar la compra.

## Historias de usuario

1. Como encargado quiero ver todos los productos en una tabla con su precio y stock.
2. Como encargado quiero crear un producto indicando nombre, descripción, precio,
   stock, categoría e imagen.
3. Como encargado quiero editar un producto existente.
4. Como encargado quiero borrar un producto para que deje de mostrarse.
5. Como encargado quiero que el sistema rechace precios negativos o stock inválido.
6. Como visitante quiero ver el catálogo de productos sin crear una cuenta.
7. Como visitante quiero filtrar los productos por categoría.
8. Como visitante quiero saber si un producto está disponible antes de intentar comprarlo.
9. Como visitante quiero acceder al catálogo desde la portada.
10. Como visitante quiero añadir productos al carrito sin crear una cuenta.
11. Como visitante quiero ver en la cabecera cuántas unidades llevo.
12. Como visitante quiero revisar el precio unitario, la cantidad y el total.
13. Como visitante quiero ajustar cantidades o eliminar productos antes de comprar.
14. Como visitante quiero conservar el carrito si recargo la página.
15. Como visitante quiero que al finalizar la compra se me pida iniciar sesión y
    volver al carrito sin perder los productos.
16. Como cliente quiero crear un pedido y que el stock se descuente una sola vez.
17. Como cliente quiero ver una página de éxito con el resumen de mi compra.
18. Como cliente quiero consultar el historial y el detalle de mis pedidos.
19. Como cliente quiero que, si un producto se agota mientras compro, se me avise
    y no se cree un pedido incompleto.
20. Como cliente quiero que un doble clic o un reintento no duplique el pedido.
21. Como cliente quiero que nadie pueda ver mis pedidos cambiando la URL.

## Modelo

```prisma
enum ProductCategory {
  ordenadores
  portatiles
  impresoras
  accesorios
  consumibles
}

model Product {
  id          String          @id @default(cuid())
  name        String
  description String          @db.Text
  price       Decimal         @db.Decimal(10, 2)
  stock       Int             @default(0)
  imageUrl    String?
  category    ProductCategory
  active      Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([category])
  @@index([active])
  @@map("products")
}

enum OrderStatus {
  pendiente
  pagado
  entregado
  cancelado
}

model Order {
  id             String      @id @default(cuid())
  userId         String
  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  total          Decimal     @db.Decimal(10, 2)
  status         OrderStatus @default(pendiente)
  idempotencyKey String?
  items          OrderItem[]
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@unique([userId, idempotencyKey])
  @@index([userId, createdAt])
  @@map("orders")
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  quantity  Int
  price     Decimal @db.Decimal(10, 2)

  @@unique([orderId, productId])
  @@index([productId])
  @@map("order_items")
}

enum StockMovementReason {
  stock_inicial
  venta
  cancelacion_pedido
  reposicion
  ajuste
}

model StockMovement {
  id String @id @default(cuid())

  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  variation Int
  reason    StockMovementReason

  orderId String?
  order   Order? @relation(fields: [orderId], references: [id], onDelete: SetNull)

  userId String?
  user   User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  note      String?
  createdAt DateTime @default(now())

  @@index([productId, createdAt])
  @@index([orderId])
  @@map("stock_movements")
}
```

## Reglas de negocio

- El precio debe ser mayor que 0 y tener como máximo dos decimales.
- El stock es un entero mayor o igual que 0.
- La categoría pertenece a una lista cerrada.
- La imagen es opcional; si falta, se muestra un placeholder.
- Borrar un producto es un borrado lógico: `active = false`.
- Los productos inactivos no aparecen en el panel ni en el catálogo público.
- El catálogo público muestra solo productos activos, del más reciente al más antiguo.
- Stock 0 se muestra como «Agotado» y no permite añadir al carrito.
- Stock 1–3 avisa de pocas unidades; a partir de 4 se muestra el total disponible.
- Una categoría desconocida en la URL equivale a «Todos».
- El carrito anónimo vive en LocalStorage; no crea pedidos ni descuenta stock.
- La clave de almacenamiento está versionada; los datos malformados o de una
  versión anterior se descartan sin romper la página.
- El navegador solo guarda IDs y cantidades; los precios y el stock se consultan
  siempre a la base de datos al abrir el carrito.
- El contador suma unidades, no líneas. Por encima de 99 se muestra `99+`.
- Añadir respeta el stock y el carrito no permite superar el stock actual.
- Un producto inexistente, inactivo o con stock 0 se retira con aviso.
- El carrito no se sincroniza con la cuenta; el checkout de la Tarea 4 exige
  iniciar sesión y conserva los productos locales.

### Edición y ajuste de stock

- El alta valida y fija el stock inicial; la edición no acepta ni escribe stock,
  aunque el campo se inyecte en la petición.
- La edición muestra el stock como dato de solo lectura y remite al ajuste.
- Solo `encargado` y `admin` pueden ajustar stock; la acción revalida el rol en
  servidor.
- La variación es un entero distinto de cero y como máximo de 10.000 unidades por
  movimiento.
- Reposición: solo positiva, con nota opcional.
- Ajuste: positivo o negativo, con nota obligatoria.
- Solo se ajustan productos activos. La actualización condicional impide que el
  stock quede negativo y el movimiento se crea en la misma transacción.
- El historial muestra los últimos 10 movimientos con fecha, motivo, variación,
  usuario o «Sistema» y el pedido abreviado, enlazado al detalle del pedido.

### Pedidos

- Solo un usuario autenticado puede crear un pedido; la acción vuelve a comprobar
  la sesión en servidor.
- El servidor relee precio, stock y estado de cada producto. Nunca confía en
  precios ni totales enviados por el navegador.
- El precio unitario se copia a `OrderItem` y el total se guarda como
  `Decimal(10,2)`; un cambio futuro de precio no altera pedidos históricos.
- Los importes se calculan en céntimos y se rechaza un total que no quepa en
  `Decimal(10,2)`.
- Stock y pedido se escriben en una única transacción. Cada producto se descuenta
  con un `updateMany` condicional (`active = true` y `stock >= cantidad`) y las
  líneas se ordenan por id para reducir bloqueos cruzados.
- Si cualquier línea falla, se revierte la transacción completa y no se crea el
  pedido; el carrito se reconcilia con el stock actual.
- La clave de idempotencia es un UUID único por usuario. Un reintento con la misma
  clave devuelve el pedido existente. Si dos peticiones compiten, la restricción
  única resuelve la carrera y la perdedora consulta el pedido ganador.
- Los pedidos nuevos nacen en `pendiente`; «pagado» se marca a mano porque no hay
  pasarela de pago.
- Transiciones permitidas: `pendiente → pagado | cancelado` y
  `pagado → entregado | cancelado`. `entregado` y `cancelado` son finales.
- Cada cambio usa una actualización condicional sobre el estado esperado. Si el
  pedido cambió, no se escribe nada y la petición perdedora recibe un mensaje para
  recargar.
- La cancelación se ejecuta en una transacción: primero actualiza el estado de forma
  condicional y solo si modificó una fila lee las líneas. Después repone el stock de
  todas ellas, incluidas las de productos archivados, y crea un movimiento positivo
  `cancelacion_pedido` por línea, ligado al pedido y al usuario.
- Una segunda cancelación no repone stock ni crea movimientos.
- Cancelar un pedido pagado exige motivo y avisa de que la aplicación no gestiona
  reembolsos.
- El carrito solo se vacía después de recibir un pedido creado correctamente.
- El historial y el detalle filtran por `userId`; un identificador ajeno devuelve
  404 sin revelar si existe.
- El panel de pedidos es exclusivo de `encargado` y `admin`; un pedido inexistente
  devuelve 404.

### Movimientos de stock

- Todo cambio de stock se registra en `StockMovement` dentro de la misma
  transacción que modifica `Product.stock`.
- Invariante del libro: `Product.stock = suma de StockMovement.variation` para
  cada producto. Una suma vacía vale 0.
- `variation` es un entero distinto de cero y su signo depende del motivo:
  - `venta`: negativo;
  - `stock_inicial`, `reposicion` y `cancelacion_pedido`: positivo;
  - `ajuste`: positivo o negativo, nunca cero.
- `productId` es obligatorio y usa `onDelete: Restrict`: un producto con
  movimientos no se borra físicamente. El catálogo usa borrado lógico.
- `userId` es opcional. `null` representa sistema, migración o seed. Si se borra
  el usuario, el movimiento se conserva con `userId = null`.
- `orderId` es opcional. Si se borra el pedido, el movimiento se conserva con
  `orderId = null`.
- La migración crea un `stock_inicial` por cada producto existente con stock
  mayor que cero, incluidos los archivados. Los productos con stock 0 no reciben
  movimiento porque la variación no puede ser cero y la suma vacía ya es 0.
- El checkout crea un movimiento `venta` por cada línea, con variación negativa y
  ligado al pedido, después de crear el pedido y dentro de su misma transacción.
- El alta de producto con stock mayor que cero crea su `stock_inicial` en la misma
  transacción.
- El seed solo crea `stock_inicial` cuando crea el producto, usando el stock
  inicial definido en los datos demo. Si el producto ya existía, no crea ni
  completa movimientos: su stock pudo cambiar por ventas o reposiciones.
- Un ajuste manual crea `reposicion` o `ajuste` con la variación, la nota y el
  usuario que lo realizó. La actualización de stock y el movimiento son atómicos.
- La cancelación de un pedido crea un movimiento `cancelacion_pedido` positivo por
  cada línea, con `orderId` y el usuario que cancela. No se filtra `active`, así que
  un producto archivado también recupera stock.
- La cancelación se aplica después de que el cambio condicional de estado haya
  modificado una fila; si pierde la carrera, no se repone stock.
- Los pedidos pendientes retienen el stock descontado hasta que se cancelan. No hay
  liberación automática ni reserva al añadir al carrito.

## Criterios de aceptación

### Tarea 1

- [x] La migración crea `products` sin afectar a las tablas existentes.
- [x] El seed crea productos demo de forma idempotente.
- [x] `/admin/productos` lista productos y muestra precio, stock y categoría.
- [x] Se puede crear, editar y borrar un producto.
- [x] Solo `encargado` y `admin` acceden al panel y a las acciones.
- [x] Los errores de validación se muestran por campo.
- [x] Los tests de validación y de las acciones pasan.
- [x] `typecheck`, `lint` y `build` pasan.

### Tarea 2

- [x] `/productos` es público y muestra solo productos activos.
- [x] Cada tarjeta incluye imagen, nombre, categoría, precio y stock.
- [x] Los filtros por categoría actualizan el listado y marcan la opción activa.
- [x] Un producto con stock 0 muestra «Agotado» y el botón deshabilitado.
- [x] El botón «Añadir al carrito» está integrado con el carrito local de la Tarea 3.
- [x] La cabecera y el hero enlazan al catálogo.
- [x] El seed incluye seis productos demo, uno de ellos agotado.
- [x] Los tests de filtros y textos de stock pasan.
- [x] `typecheck`, `lint` y `build` pasan.

### Tarea 3

- [x] El icono de cabecera muestra el total de unidades y enlaza a `/carrito`.
- [x] Añadir desde el catálogo actualiza el contador y muestra confirmación.
- [x] El carrito persiste tras recargar la página.
- [x] `/carrito` muestra producto, precio unitario, cantidad, subtotal y total.
- [x] Los botones `+`/`-` respetan el stock y el mínimo de una unidad.
- [x] Se pueden eliminar líneas y se muestra el estado vacío.
- [x] Precios y stock se revalidan en servidor; LocalStorage solo guarda IDs y cantidades.
- [x] Los productos agotados, inactivos o inexistentes se retiran con aviso.
- [x] Los datos corruptos o de una versión anterior se descartan sin romper la página.
- [x] «Finalizar compra» está deshabilitado con nota de la siguiente tarea.
- [x] Tests, `typecheck`, `lint` y `build` pasan.

### Tarea 4

- [x] Un visitante que pulsa «Finalizar compra» va a login con retorno a `/carrito`.
- [x] El callback seguro se conserva al pasar por el registro y se descarta si es externo.
- [x] Un cliente autenticado crea `Order` y `OrderItem` desde el carrito.
- [x] El stock se descuenta de forma atómica y una compra concurrente sin stock no crea pedido.
- [x] El total y los precios unitarios se calculan y congelan en servidor.
- [x] La idempotencia evita pedidos duplicados por doble clic o reintento.
- [x] El carrito se vacía solo tras el éxito y se conserva si hay error.
- [x] Existe página de éxito/detalle y un historial en `/app/pedidos`.
- [x] Un pedido de otro usuario devuelve 404.
- [x] Tests de cálculo, stock, validación, acción, idempotencia y callback; `typecheck`, `lint` y `build` pasan.

### Tarea 5

- [x] `/productos/[id]` muestra la ficha de un producto activo.
- [x] Un producto inexistente o archivado devuelve 404.
- [x] La ficha enlaza de vuelta al catálogo y conserva la categoría cuando aplica.
- [x] Tests, `typecheck`, `lint` y `build` pasan.

### Tarea 6A

- [x] Existen `StockMovement` y `StockMovementReason` con restricciones de signo.
- [x] La migración backfill incluye productos archivados con stock mayor que cero.
- [x] Checkout, alta y seed mantienen la invariante del libro.
- [x] La consulta de consistencia devuelve cero filas.
- [x] Tests de movimientos, `typecheck`, `lint` y `build` pasan.

### Tarea 6B

- [x] La edición no puede modificar stock aunque se inyecte en la petición.
- [x] Solo `encargado` y `admin` ajustan stock, con rol revalidado en servidor.
- [x] Reposición, ajuste, nota, máximo y vista previa funcionan según las reglas.
- [x] Un ajuste que dejaría stock negativo se rechaza sin crear movimiento.
- [x] La ficha muestra los últimos 10 movimientos y enlaza al pedido asociado.
- [x] QA local: reposición, ajuste negativo, rechazo por negativo y consistencia.
- [x] Tests, `typecheck`, `lint` y `build` pasan.

### Tarea 7

- [x] `/admin/pedidos` lista y filtra pedidos con contadores.
- [x] El detalle muestra cliente, líneas a precio congelado y total.
- [x] Las transiciones válidas e inválidas están cubiertas por tests.
- [x] La actualización condicional resuelve dobles clics y carreras.
- [x] Cancelar repone stock de todas las líneas y crea un movimiento por línea.
- [x] La segunda cancelación no repone stock.
- [x] Cancelar un pedido pagado exige motivo y avisa de que no hay reembolso.
- [x] El cliente ve el estado actualizado en `/app/pedidos`.
- [x] QA local: pedido pagado, cancelación, doble cancelación y consistencia.
- [x] Tests, `typecheck`, `lint` y `build` pasan.

## Fuera de alcance

- Pasarela de pago, cobro real y reembolsos.
- Historial de estados de pedido y notificaciones automáticas.
- Integración del catálogo con el área de cliente (recomendaciones o
  personalización).
- Liberación automática o reserva de stock distinta del descuento al crear el
  pedido.
- Sincronización del carrito con la cuenta al iniciar sesión.
- Cupones, envíos, impuestos y facturación.
- Subida de imágenes.
- Gestión de categorías desde el panel.
- Slug, SKU, buscador y paginación.
- Tests de integración automáticos con base de datos real (deuda anotada).
