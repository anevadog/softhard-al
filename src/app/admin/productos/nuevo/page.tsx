import Link from "next/link";

import { ProductForm } from "@/components/admin/product-form";

export const metadata = {
  title: "Nuevo producto",
};

export default function NuevoProductoPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/productos"
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Volver a productos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Nuevo producto
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Añade un producto al catálogo. Podrás editarlo o borrarlo después.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <ProductForm />
      </section>
    </div>
  );
}
