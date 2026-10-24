/* eslint-disable @next/next/no-img-element */
import { AddToCartButton } from "@/components/site/add-to-cart-button";
import { estadoStock, textoStock } from "@/lib/catalog";
import { formatEuros } from "@/lib/format";
import {
  PRODUCT_CATEGORY_LABELS,
  type ProductoPublico,
} from "@/lib/products";

const PLACEHOLDER = "/productos/placeholder.svg";

export function ProductCard({ producto }: { producto: ProductoPublico }) {
  const estado = estadoStock(producto.stock);
  const agotado = estado === "agotado";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={producto.imageUrl ?? PLACEHOLDER}
          alt={producto.name}
          loading="lazy"
          className={
            agotado
              ? "h-full w-full object-cover opacity-60"
              : "h-full w-full object-cover"
          }
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm">
          {PRODUCT_CATEGORY_LABELS[producto.category]}
        </span>
        {agotado ? (
          <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            Agotado
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold text-slate-950">
          {producto.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {producto.description}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="text-lg font-semibold text-slate-950">
            {formatEuros(producto.price)}
          </p>
          <p
            className={
              estado === "agotado"
                ? "text-xs font-medium text-rose-600"
                : estado === "bajo"
                  ? "text-xs font-medium text-amber-600"
                  : "text-xs text-slate-500"
            }
          >
            {textoStock(producto.stock)}
          </p>
        </div>

        <div className="mt-4">
          <AddToCartButton agotado={agotado} nombre={producto.name} />
        </div>
      </div>
    </article>
  );
}
