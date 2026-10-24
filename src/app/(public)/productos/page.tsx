import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFilters } from "@/components/site/catalog-filters";
import { ProductCard } from "@/components/site/product-card";
import { SectionHeading } from "@/components/site/section-heading";
import { parseCategoriaProducto } from "@/lib/catalog";
import {
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from "@/lib/products";
import { listarProductosPublicos } from "@/server/data/products";

export const metadata: Metadata = {
  title: "Productos",
  description:
    "Catálogo de ordenadores, portátiles, impresoras, accesorios y consumibles de SoftHard A&L.",
};

type ProductosPageProps = {
  searchParams: Promise<{ categoria?: string | string[] }>;
};

export default async function ProductosPage({
  searchParams,
}: ProductosPageProps) {
  const { categoria: categoriaParam } = await searchParams;
  const categoria = parseCategoriaProducto(categoriaParam);
  const productos = await listarProductosPublicos(categoria ?? undefined);

  const resumen =
    productos.length === 0
      ? "No hay productos que coincidan con el filtro."
      : `${productos.length} ${
          productos.length === 1 ? "producto" : "productos"
        }${categoria ? ` en ${PRODUCT_CATEGORY_LABELS[categoria]}` : ""}`;

  return (
    <div className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <SectionHeading
            as="h1"
            align="left"
            eyebrow="Tienda"
            title="Catálogo de productos"
            description="Equipos, periféricos y consumibles seleccionados para casa y oficina. Consulta disponibilidad y categoría antes de elegir."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <CatalogFilters categoriaActiva={categoria} />
        <p className="mt-4 text-sm text-slate-500">{resumen}</p>

        {productos.length === 0 ? (
          <EmptyCatalog categoria={categoria} />
        ) : (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {productos.map((producto) => (
              <li key={producto.id}>
                <ProductCard producto={producto} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyCatalog({ categoria }: { categoria: ProductCategory | null }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="font-medium text-slate-900">
        {categoria
          ? "No hay productos en esta categoría."
          : "Todavía no hay productos disponibles."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {categoria
          ? "Prueba con otra categoría o consulta el catálogo completo."
          : "Vuelve pronto: estamos preparando el catálogo."}
      </p>
      <Link
        href={categoria ? "/productos" : "/#contacto"}
        className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        {categoria ? "Ver todos los productos" : "Contactar"}
      </Link>
    </div>
  );
}
