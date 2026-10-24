# Spec Fase 2 — Catálogo y productos

## Objetivo

Construir la base del e-commerce: catálogo de productos gestionable desde el panel
interno. La tienda pública, el carrito y los pedidos llegan en tareas posteriores.

## Alcance de la Tarea 1

- Modelo `Product` con categoría, precio, stock, imagen y borrado lógico.
- Migración de base de datos.
- Panel `/admin/productos` con listado, creación, edición y borrado.
- Acceso exclusivo para `encargado` y `admin`.
- Validación Zod en servidor.
- Tests de validación y de las acciones de crear/editar.
- Productos de demostración en el seed.

## Actores

- **Encargado / admin**: gestiona el catálogo desde el panel.
- **Cliente / trabajador**: sin acceso al panel de productos.
- **Visitante** (más adelante): consultará el catálogo público.

## Historias de usuario

1. Como encargado quiero ver todos los productos en una tabla con su precio y stock.
2. Como encargado quiero crear un producto indicando nombre, descripción, precio,
   stock, categoría e imagen.
3. Como encargado quiero editar un producto existente.
4. Como encargado quiero borrar un producto para que deje de mostrarse.
5. Como encargado quiero que el sistema rechace precios negativos o stock inválido.

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
- Los productos inactivos no aparecen en el panel ni en el futuro catálogo público.

## Criterios de aceptación

- [x] La migración crea `products` sin afectar a las tablas existentes.
- [x] El seed crea 5 productos demo de forma idempotente.
- [x] `/admin/productos` lista productos y muestra precio, stock y categoría.
- [x] Se puede crear, editar y borrar un producto.
- [x] Solo `encargado` y `admin` acceden al panel y a las acciones.
- [x] Los errores de validación se muestran por campo.
- [x] Los tests de validación y de las acciones pasan.
- [x] `typecheck`, `lint` y `build` pasan.

## Fuera de alcance

- Catálogo público y página de detalle de producto.
- Carrito, pedidos y pasarela de pago.
- Descuento automático de stock al vender.
- Subida de imágenes.
- Gestión de categorías desde el panel.
- Slug, SKU, buscador, filtros y paginación.
