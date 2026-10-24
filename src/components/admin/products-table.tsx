/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { formatEuros } from "@/lib/format";
import {
  PRODUCT_CATEGORY_LABELS,
  type ProductoAdmin,
} from "@/lib/products";

const PLACEHOLDER = "/productos/placeholder.svg";

export function ProductsTable({ productos }: { productos: ProductoAdmin[] }) {
  if (productos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
        Todavía no hay productos. Crea el primero con “Nuevo producto”.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">
                Producto
              </th>
              <th scope="col" className="px-4 py-3">
                Categoría
              </th>
              <th scope="col" className="px-4 py-3">
                Precio
              </th>
              <th scope="col" className="px-4 py-3">
                Stock
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productos.map((producto) => (
              <tr key={producto.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={producto.imageUrl ?? PLACEHOLDER}
                      alt=""
                      loading="lazy"
                      className="size-12 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {producto.name}
                      </p>
                      <p className="max-w-md truncate text-xs text-slate-500">
                        {producto.description}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {PRODUCT_CATEGORY_LABELS[producto.category]}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {formatEuros(producto.price)}
                </td>
                <td className="px-4 py-3">
                  <StockBadge stock={producto.stock} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/productos/${producto.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {productos.map((producto) => (
          <li key={producto.id}>
            <Link
              href={`/admin/productos/${producto.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
            >
              <div className="flex gap-3">
                <img
                  src={producto.imageUrl ?? PLACEHOLDER}
                  alt=""
                  loading="lazy"
                  className="size-16 shrink-0 rounded-lg border border-slate-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {producto.name}
                    </p>
                    <StockBadge stock={producto.stock} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {PRODUCT_CATEGORY_LABELS[producto.category]}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatEuros(producto.price)}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 ring-inset">
        Sin stock
      </span>
    );
  }

  if (stock <= 3) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 ring-inset">
        Quedan {stock}
      </span>
    );
  }

  return <span className="text-sm text-slate-700">{stock}</span>;
}
