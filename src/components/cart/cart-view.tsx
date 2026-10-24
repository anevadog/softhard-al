"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import {
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
} from "@/components/site/icons";
import {
  calcularSubtotalCentimos,
  calcularTotalCentimos,
  type CartItem,
} from "@/lib/cart";
import { formatEuros } from "@/lib/format";
import {
  PRODUCT_CATEGORY_LABELS,
  type ProductoPublico,
} from "@/lib/products";
import { obtenerProductosCarritoAction } from "@/server/actions/cart";

const PLACEHOLDER = "/productos/placeholder.svg";

type ProductosPorId = Record<string, ProductoPublico>;

export function CartView() {
  const { items, totalUnidades, hidratado, actualizarCantidad, eliminar } =
    useCart();
  const [productos, setProductos] = useState<ProductosPorId>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const itemsRef = useRef(items);

  const idsKey = useMemo(
    () => items.map((item) => item.productId).sort().join("|"),
    [items],
  );

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!hidratado) {
      return;
    }

    const ids = idsKey === "" ? [] : idsKey.split("|");

    if (ids.length === 0) {
      setProductos({});
      setCargando(false);
      setError(null);
      return;
    }

    let cancelado = false;

    setCargando(true);
    setError(null);

    obtenerProductosCarritoAction(ids)
      .then((data) => {
        if (cancelado) {
          return;
        }

        const mapa: ProductosPorId = Object.fromEntries(
          data.map((producto) => [producto.id, producto]),
        );

        setProductos(mapa);
        setCargando(false);

        const actuales = itemsRef.current;
        const noDisponibles = actuales.filter((item) => {
          const producto = mapa[item.productId];

          return !producto || producto.stock <= 0;
        });
        const ajustados = actuales.filter((item) => {
          const producto = mapa[item.productId];

          return Boolean(
            producto && producto.stock > 0 && item.quantity > producto.stock,
          );
        });

        if (noDisponibles.length > 0) {
          noDisponibles.forEach((item) => eliminar(item.productId));
        }

        ajustados.forEach((item) => {
          const producto = mapa[item.productId];

          if (producto) {
            actualizarCantidad(
              item.productId,
              producto.stock,
              producto.stock,
            );
          }
        });

        if (noDisponibles.length > 0 && ajustados.length > 0) {
          setAviso(
            "Algunos productos ya no están disponibles y hemos ajustado las cantidades al stock actual.",
          );
        } else if (noDisponibles.length > 0) {
          setAviso(
            "Algunos productos ya no están disponibles y se han quitado del carrito.",
          );
        } else if (ajustados.length > 0) {
          setAviso(
            "Hemos ajustado las cantidades de algunos productos al stock disponible.",
          );
        }
      })
      .catch(() => {
        if (!cancelado) {
          setCargando(false);
          setError(
            "No se pudieron cargar los productos del carrito. Inténtalo de nuevo.",
          );
        }
      });

    return () => {
      cancelado = true;
    };
  }, [actualizarCantidad, eliminar, hidratado, idsKey, reintento]);

  const lineas = items.flatMap((item) => {
    const producto = productos[item.productId];

    return producto ? [{ item, producto }] : [];
  });

  const totalCentimos = calcularTotalCentimos(
    items,
    Object.values(productos),
  );

  if (!hidratado) {
    return <CargandoCarrito />;
  }

  return (
    <div>
      {aviso ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {aviso}
        </p>
      ) : null}

      {items.length === 0 ? (
        <CarritoVacio />
      ) : error ? (
        <ErrorCarrito
          mensaje={error}
          alReintentar={() => setReintento((valor) => valor + 1)}
        />
      ) : cargando || lineas.length === 0 ? (
        <CargandoCarrito />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ul className="space-y-4">
            {lineas.map(({ item, producto }) => (
              <LineaCarrito
                key={producto.id}
                item={item}
                producto={producto}
                alCambiarCantidad={actualizarCantidad}
                alEliminar={eliminar}
              />
            ))}
          </ul>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-slate-950">
              Resumen del pedido
            </h2>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-600">Unidades</dt>
                <dd className="font-medium text-slate-900">{totalUnidades}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="font-medium text-slate-900">
                  {formatEuros(totalCentimos / 100)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 text-base font-semibold">
                <dt className="text-slate-950">Total</dt>
                <dd className="text-slate-950">
                  {formatEuros(totalCentimos / 100)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              disabled
              className="mt-6 w-full cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500"
            >
              Finalizar compra
            </button>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              El checkout estará disponible en la próxima tarea.
            </p>

            <Link
              href="/productos"
              className="mt-5 inline-flex text-sm font-medium text-slate-700 underline underline-offset-2 transition-colors hover:text-slate-950"
            >
              Seguir comprando
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

function LineaCarrito({
  item,
  producto,
  alCambiarCantidad,
  alEliminar,
}: {
  item: CartItem;
  producto: ProductoPublico;
  alCambiarCantidad: (
    productId: string,
    cantidad: number,
    stock: number,
  ) => void;
  alEliminar: (productId: string) => void;
}) {
  const subtotalCentimos = calcularSubtotalCentimos(
    producto.price,
    item.quantity,
  );
  const maximoAlcanzado = item.quantity >= producto.stock;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex gap-4">
        <img
          src={producto.imageUrl ?? PLACEHOLDER}
          alt={producto.name}
          loading="lazy"
          className="size-24 shrink-0 rounded-xl border border-slate-200 object-cover sm:size-28"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {PRODUCT_CATEGORY_LABELS[producto.category]}
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-950">
                {producto.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {formatEuros(producto.price)} / unidad
              </p>
            </div>

            <button
              type="button"
              onClick={() => alEliminar(producto.id)}
              aria-label={`Eliminar ${producto.name} del carrito`}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() =>
                    alCambiarCantidad(
                      producto.id,
                      item.quantity - 1,
                      producto.stock,
                    )
                  }
                  disabled={item.quantity <= 1}
                  aria-label={`Quitar una unidad de ${producto.name}`}
                  className="flex size-9 items-center justify-center text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <MinusIcon className="size-4" />
                </button>
                <span
                  aria-live="polite"
                  className="min-w-10 border-x border-slate-200 px-2 text-center text-sm font-medium text-slate-900"
                >
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    alCambiarCantidad(
                      producto.id,
                      item.quantity + 1,
                      producto.stock,
                    )
                  }
                  disabled={maximoAlcanzado}
                  aria-label={`Añadir una unidad de ${producto.name}`}
                  className="flex size-9 items-center justify-center text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <PlusIcon className="size-4" />
                </button>
              </div>
              {maximoAlcanzado ? (
                <p className="mt-1.5 text-xs text-amber-600">
                  Máximo disponible: {producto.stock}
                </p>
              ) : null}
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Subtotal
              </p>
              <p className="mt-1 text-base font-semibold text-slate-950">
                {formatEuros(subtotalCentimos / 100)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function CarritoVacio() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <ShoppingCartIcon className="size-6" />
      </span>
      <p className="mt-4 text-lg font-semibold text-slate-950">
        Tu carrito está vacío
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Explora el catálogo y añade los productos que necesites.
      </p>
      <Link
        href="/productos"
        className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        Ver productos
      </Link>
    </div>
  );
}

function CargandoCarrito() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando carrito"
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="space-y-4">
        {[0, 1].map((indice) => (
          <div
            key={indice}
            className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}

function ErrorCarrito({
  mensaje,
  alReintentar,
}: {
  mensaje: string;
  alReintentar: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center"
    >
      <p className="font-medium text-rose-900">{mensaje}</p>
      <p className="mt-2 text-sm text-rose-700">
        Tus productos siguen guardados en este navegador.
      </p>
      <button
        type="button"
        onClick={alReintentar}
        className="mt-5 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-800"
      >
        Reintentar
      </button>
    </div>
  );
}
