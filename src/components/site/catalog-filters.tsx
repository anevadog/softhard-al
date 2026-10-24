import Link from "next/link";

import { hrefCategoriaProducto } from "@/lib/catalog";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from "@/lib/products";

const FILTROS: { categoria: ProductCategory | null; label: string }[] = [
  { categoria: null, label: "Todos" },
  ...PRODUCT_CATEGORIES.map((categoria) => ({
    categoria,
    label: PRODUCT_CATEGORY_LABELS[categoria],
  })),
];

export function CatalogFilters({
  categoriaActiva,
}: {
  categoriaActiva: ProductCategory | null;
}) {
  return (
    <nav
      aria-label="Filtrar productos por categoría"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
    >
      {FILTROS.map((filtro) => {
        const activa = filtro.categoria === categoriaActiva;

        return (
          <Link
            key={filtro.categoria ?? "todos"}
            href={hrefCategoriaProducto(filtro.categoria)}
            aria-current={activa ? "page" : undefined}
            className={
              activa
                ? "shrink-0 rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                : "shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            }
          >
            {filtro.label}
          </Link>
        );
      })}
    </nav>
  );
}
