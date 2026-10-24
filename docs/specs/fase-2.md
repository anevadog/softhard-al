# Spec Fase 2 — Catálogo y productos

## Objetivo

Construir la base del e-commerce: catálogo público y gestión interna de productos.
La ficha de detalle, el carrito y los pedidos llegan en tareas posteriores.

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
- Botón «Añadir al carrito» informativo, sin carrito real todavía.
- Enlaces al catálogo desde la cabecera y el hero de la landing.
- Producto de demostración agotado para visualizar el estado.

## Actores

- **Encargado / admin**: gestiona el catálogo desde el panel.
- **Cliente / trabajador**: sin acceso al panel de productos.
- **Visitante**: consulta el catálogo público sin registrarse.

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
- [x] El botón «Añadir al carrito» informa de que el carrito llega en la próxima tarea.
- [x] La cabecera y el hero enlazan al catálogo.
- [x] El seed incluye seis productos demo, uno de ellos agotado.
- [x] Los tests de filtros y textos de stock pasan.
- [x] `typecheck`, `lint` y `build` pasan.

## Fuera de alcance

- Página de detalle de producto.
- Carrito, pedidos y pasarela de pago.
- Descuento automático de stock al vender.
- Subida de imágenes.
- Gestión de categorías desde el panel.
- Slug, SKU, buscador y paginación.
