import type { ProductCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { ProductoAdmin, ProductoPublico } from "@/lib/products";
import { crearMovimientoStockInicial } from "@/server/data/stock-movements";

export type DatosProducto = {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  category: ProductCategory;
};

/** La edición nunca incluye stock: se cambia mediante movimientos. */
export type DatosProductoEdicion = Omit<DatosProducto, "stock">;

const PRODUCTO_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  imageUrl: true,
  category: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

const PRODUCTO_PUBLICO_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock: true,
  imageUrl: true,
  category: true,
} as const;

/** Convierte el Decimal de Prisma en número para la capa de UI. */
function aProductoAdmin(producto: {
  id: string;
  name: string;
  description: string;
  price: unknown;
  stock: number;
  imageUrl: string | null;
  category: ProductCategory;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductoAdmin {
  return {
    ...producto,
    price: Number(producto.price),
  };
}

function aProductoPublico(producto: {
  id: string;
  name: string;
  description: string;
  price: unknown;
  stock: number;
  imageUrl: string | null;
  category: ProductCategory;
}): ProductoPublico {
  return {
    ...producto,
    price: Number(producto.price),
  };
}

/** Catálogo público: solo productos activos y, si se indica, de una categoría. */
export async function listarProductosPublicos(
  categoria?: ProductCategory,
): Promise<ProductoPublico[]> {
  const productos = await prisma.product.findMany({
    where: {
      active: true,
      ...(categoria ? { category: categoria } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: PRODUCTO_PUBLICO_SELECT,
  });

  return productos.map(aProductoPublico);
}

/** Ficha pública: solo devuelve productos activos. */
export async function obtenerProductoPublico(
  id: string,
): Promise<ProductoPublico | null> {
  const producto = await prisma.product.findFirst({
    where: { id, active: true },
    select: PRODUCTO_PUBLICO_SELECT,
  });

  return producto ? aProductoPublico(producto) : null;
}

/** Productos activos que necesita el carrito para refrescar precio y stock. */
export async function listarProductosPorIds(
  ids: string[],
): Promise<ProductoPublico[]> {
  if (ids.length === 0) {
    return [];
  }

  const productos = await prisma.product.findMany({
    where: {
      id: { in: ids },
      active: true,
    },
    select: PRODUCTO_PUBLICO_SELECT,
  });

  return productos.map(aProductoPublico);
}

export async function listarProductosAdmin(): Promise<ProductoAdmin[]> {
  const productos = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: PRODUCTO_SELECT,
  });

  return productos.map(aProductoAdmin);
}

export async function obtenerProductoAdmin(
  id: string,
): Promise<ProductoAdmin | null> {
  const producto = await prisma.product.findFirst({
    where: { id, active: true },
    select: PRODUCTO_SELECT,
  });

  return producto ? aProductoAdmin(producto) : null;
}

export async function crearProducto(
  datos: DatosProducto,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const producto = await tx.product.create({
      data: {
        name: datos.name,
        description: datos.description,
        price: datos.price.toFixed(2),
        stock: datos.stock,
        imageUrl: datos.imageUrl,
        category: datos.category,
      },
      select: { id: true, stock: true },
    });

    await crearMovimientoStockInicial(tx, {
      productId: producto.id,
      stock: producto.stock,
      note: "Stock inicial del alta",
    });

    return { id: producto.id };
  });
}

export async function actualizarProducto(
  id: string,
  datos: DatosProductoEdicion,
): Promise<boolean> {
  const resultado = await prisma.product.updateMany({
    where: { id, active: true },
    data: {
      name: datos.name,
      description: datos.description,
      price: datos.price.toFixed(2),
      imageUrl: datos.imageUrl,
      category: datos.category,
    },
  });

  return resultado.count > 0;
}

export async function archivarProducto(id: string): Promise<boolean> {
  const resultado = await prisma.product.updateMany({
    where: { id, active: true },
    data: { active: false },
  });

  return resultado.count > 0;
}
