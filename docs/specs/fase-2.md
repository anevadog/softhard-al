# Spec Fase 2 — Catálogo, carrito y pedidos

## Objetivo

Construir el flujo de compra de la tienda: catálogo público, gestión interna de
productos, carrito local, checkout transaccional, historial de pedidos y página de
éxito. La ficha de detalle de producto queda para una tarea posterior.

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

## Actores

- **Encargado / admin**: gestiona el catálogo desde el panel.
- **Cliente / trabajador**: sin acceso al panel de productos; puede comprar y
  consultar sus propios pedidos.
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
- Los pedidos nuevos nacen en `pendiente`. `pagado`, `entregado` y `cancelado`
  quedan preparados para tareas posteriores.
- El carrito solo se vacía después de recibir un pedido creado correctamente.
- El historial y el detalle filtran por `userId`; un identificador ajeno devuelve
  404 sin revelar si existe.
- No hay pasarela de pago: el pedido queda pendiente de gestión manual.

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

## Fuera de alcance

- Página de detalle de producto.
- Pasarela de pago y cobro real.
- Gestión administrativa de pedidos, cambios manuales de estado, cancelación y
  reposición de stock.
- Sincronización del carrito con la cuenta al iniciar sesión.
- Cupones, envíos, impuestos y facturación.
- Subida de imágenes.
- Gestión de categorías desde el panel.
- Slug, SKU, buscador y paginación.
