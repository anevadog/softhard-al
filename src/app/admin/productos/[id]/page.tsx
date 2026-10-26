import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteProductForm } from "@/components/admin/delete-product-form";
import { ProductForm } from "@/components/admin/product-form";
import { StockAdjustmentForm } from "@/components/admin/stock-adjustment-form";
import { StockHistory } from "@/components/admin/stock-history";
import { formatEuros, formatearFechaCorta } from "@/lib/format";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/products";
import { obtenerProductoAdmin } from "@/server/data/products";
import { listarMovimientosProducto } from "@/server/data/stock";

export const metadata = {
  title: "Editar producto",
};

export default async function EditarProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ajuste?: string }>;
}) {
  const { id } = await params;
  const { ajuste } = await searchParams;
  const producto = await obtenerProductoAdmin(id);

  if (!producto) {
    notFound();
  }

  const movimientos = await listarMovimientosProducto(id, 10);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/productos"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver a productos
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {producto.name}
          </h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 ring-inset">
            {PRODUCT_CATEGORY_LABELS[producto.category]}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {formatEuros(producto.price)} · Actualizado el{" "}
          {formatearFechaCorta(producto.updatedAt)}
        </p>
      </div>

      {ajuste === "1" ? (
        <p
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          Stock actualizado correctamente.
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <ProductForm producto={producto} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Ajuste de stock
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Registra una reposición o corrige el stock. Cada cambio queda en el
          historial con el usuario que lo realizó.
        </p>
        <div className="mt-4 max-w-md">
          <StockAdjustmentForm productId={producto.id} stock={producto.stock} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Últimos movimientos
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Los 10 cambios de stock más recientes de este producto.
        </p>
        <div className="mt-4">
          <StockHistory movimientos={movimientos} />
        </div>
      </section>

      <section className="rounded-xl border border-rose-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Zona de peligro
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Borrar el producto lo oculta del catálogo. No se elimina de la base de
          datos para conservar el historial de futuros pedidos.
        </p>
        <div className="mt-4">
          <DeleteProductForm
            productId={producto.id}
            productName={producto.name}
          />
        </div>
      </section>
    </div>
  );
}
