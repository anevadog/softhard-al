import type { ProductCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { ProductoAdmin } from "@/lib/products";

export type DatosProducto = {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  category: ProductCategory;
};

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
  return prisma.product.create({
    data: {
      ...datos,
      price: datos.price.toFixed(2),
    },
    select: { id: true },
  });
}

export async function actualizarProducto(
  id: string,
  datos: DatosProducto,
): Promise<boolean> {
  const resultado = await prisma.product.updateMany({
    where: { id, active: true },
    data: {
      ...datos,
      price: datos.price.toFixed(2),
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
