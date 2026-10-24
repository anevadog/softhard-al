import Link from "next/link";
import type { ReactNode } from "react";

import { ProductsTable } from "@/components/admin/products-table";
import { listarProductosAdmin } from "@/server/data/products";

export const metadata = {
  title: "Productos",
};

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<{
    creado?: string;
    actualizado?: string;
    borrado?: string;
  }>;
}) {
  const { creado, actualizado, borrado } = await searchParams;
  const productos = await listarProductosAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Productos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {productos.length === 0
              ? "Todavía no hay productos en el catálogo."
              : `${productos.length} ${
                  productos.length === 1
                    ? "producto activo"
                    : "productos activos"
                } en el catálogo.`}
          </p>
        </div>

        <Link
          href="/admin/productos/nuevo"
          className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Nuevo producto
        </Link>
      </div>

      {creado === "1" ? <Aviso>Producto creado correctamente.</Aviso> : null}
      {actualizado === "1" ? (
        <Aviso>Producto actualizado correctamente.</Aviso>
      ) : null}
      {borrado === "1" ? (
        <Aviso>Producto borrado. Ya no aparece en el catálogo.</Aviso>
      ) : null}

      <ProductsTable productos={productos} />
    </div>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      role="status"
    >
      {children}
    </p>
  );
}
