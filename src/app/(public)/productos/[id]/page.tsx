/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AddToCartButton } from "@/components/site/add-to-cart-button";
import {
  estadoStock,
  hrefCategoriaProducto,
  parseCategoriaProducto,
  textoStock,
} from "@/lib/catalog";
import { formatEuros } from "@/lib/format";
import {
  PRODUCT_CATEGORY_LABELS,
  type ProductoPublico,
} from "@/lib/products";
import { productIdSchema } from "@/lib/validations/product";
import { obtenerProductoPublico } from "@/server/data/products";

const PLACEHOLDER = "/productos/placeholder.svg";

const cargarProducto = cache(obtenerProductoPublico);

type ProductoDetallePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ categoria?: string | string[] }>;
};

async function obtenerProductoDeFicha(
  id: string,
): Promise<ProductoPublico | null> {
  const parsedId = productIdSchema.safeParse(id);

  if (!parsedId.success) {
    return null;
  }

  return cargarProducto(parsedId.data);
}

export async function generateMetadata({
  params,
}: Pick<ProductoDetallePageProps, "params">): Promise<Metadata> {
  const { id } = await params;
  const producto = await obtenerProductoDeFicha(id);

  if (!producto) {
    return { title: "Producto no encontrado" };
  }

  return {
    title: producto.name,
    description: producto.description.slice(0, 160),
  };
}

export default async function ProductoDetallePage({
  params,
  searchParams,
}: ProductoDetallePageProps) {
  const [{ id }, { categoria: categoriaParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  // La página es dinámica porque lee searchParams. Así el stock se consulta en
  // cada visita y no queda cacheado tras una compra. Si se deja de leer
  // searchParams, habrá que revalidar `/productos/[id]` desde el checkout.
  const producto = await obtenerProductoDeFicha(id);

  if (!producto) {
    notFound();
  }

  const categoriaFiltro = parseCategoriaProducto(categoriaParam);
  const estado = estadoStock(producto.stock);
  const agotado = estado === "agotado";
  const categoriaLabel = PRODUCT_CATEGORY_LABELS[producto.category];
  const volverHref = hrefCategoriaProducto(categoriaFiltro);
  const categoriaHref = hrefCategoriaProducto(producto.category);

  const stockClassName =
    estado === "agotado"
      ? "text-sm font-medium text-rose-600"
      : estado === "bajo"
        ? "text-sm font-medium text-amber-600"
        : "text-sm text-slate-500";

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Migas de pan" className="text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link
                href="/productos"
                className="underline-offset-2 hover:text-slate-900 hover:underline"
              >
                Productos
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={categoriaHref}
                className="underline-offset-2 hover:text-slate-900 hover:underline"
              >
                {categoriaLabel}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-slate-900" aria-current="page">
              {producto.name}
            </li>
          </ol>
        </nav>

        <Link
          href={volverHref}
          className="mt-4 inline-flex text-sm text-slate-500 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
        >
          ← Volver al catálogo
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="aspect-[4/3] bg-slate-100">
              <img
                src={producto.imageUrl ?? PLACEHOLDER}
                alt={producto.name}
                className={
                  agotado
                    ? "h-full w-full object-cover opacity-60"
                    : "h-full w-full object-cover"
                }
              />
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                {categoriaLabel}
              </span>
              {agotado ? (
                <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                  Agotado
                </span>
              ) : null}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {producto.name}
            </h1>

            <p className="mt-4 text-2xl font-semibold text-slate-950">
              {formatEuros(producto.price)}
            </p>
            <p className={`mt-1 ${stockClassName}`}>
              {textoStock(producto.stock)}
            </p>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Descripción
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                {producto.description}
              </p>
            </div>

            <div className="mt-8 max-w-sm">
              <AddToCartButton
                productId={producto.id}
                agotado={agotado}
                nombre={producto.name}
                stock={producto.stock}
              />
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                El precio y la disponibilidad se consultan de nuevo al abrir el
                carrito.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
