import type { ProductCategory } from "@/generated/prisma/enums";

export type { ProductCategory };

/** Categorías disponibles en el catálogo. Deben coincidir con el enum de Prisma. */
export const PRODUCT_CATEGORIES = [
  "ordenadores",
  "portatiles",
  "impresoras",
  "accesorios",
  "consumibles",
] as const satisfies readonly ProductCategory[];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  ordenadores: "Ordenadores",
  portatiles: "Portátiles",
  impresoras: "Impresoras",
  accesorios: "Accesorios",
  consumibles: "Consumibles",
};

/** Producto tal y como lo consume el panel, con el precio ya como número. */
export type ProductoAdmin = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  category: ProductCategory;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Datos que necesita el formulario de edición. */
export type ProductoEditable = Pick<
  ProductoAdmin,
  "id" | "name" | "description" | "price" | "stock" | "imageUrl" | "category"
>;

/** Producto visible en el catálogo público (solo campos publicables). */
export type ProductoPublico = Pick<
  ProductoAdmin,
  "id" | "name" | "description" | "price" | "stock" | "imageUrl" | "category"
>;
