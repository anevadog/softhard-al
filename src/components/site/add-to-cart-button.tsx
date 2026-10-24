"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import { cantidadEnCarrito } from "@/lib/cart";

export function AddToCartButton({
  productId,
  agotado,
  nombre,
  stock,
}: {
  productId: string;
  agotado: boolean;
  nombre: string;
  stock: number;
}) {
  const { items, hidratado, agregar } = useCart();
  const [avisoVisible, setAvisoVisible] = useState(false);
  const temporizador = useRef<number | null>(null);

  const cantidad = cantidadEnCarrito(items, productId);
  const maximoAlcanzado = stock > 0 && cantidad >= stock;

  useEffect(() => {
    return () => {
      if (temporizador.current !== null) {
        window.clearTimeout(temporizador.current);
      }
    };
  }, []);

  function agregarAlCarrito() {
    if (!hidratado || agotado || maximoAlcanzado) {
      return;
    }

    agregar(productId, stock);
    setAvisoVisible(true);

    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current);
    }

    temporizador.current = window.setTimeout(() => {
      setAvisoVisible(false);
    }, 2000);
  }

  const aviso = avisoVisible ? (
    <p role="status" className="mt-2 text-xs leading-relaxed text-slate-500">
      Añadido al carrito.{" "}
      <Link
        href="/carrito"
        className="font-medium text-slate-900 underline underline-offset-2"
      >
        Ver carrito
      </Link>
    </p>
  ) : null;

  if (agotado) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${nombre} agotado`}
        className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500"
      >
        Agotado
      </button>
    );
  }

  if (maximoAlcanzado) {
    return (
      <div>
        <button
          type="button"
          disabled
          aria-label={`No puedes añadir más unidades de ${nombre}`}
          className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500"
        >
          Máximo en carrito
        </button>
        {aviso}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={agregarAlCarrito}
        disabled={!hidratado}
        aria-busy={!hidratado}
        aria-label={`Añadir ${nombre} al carrito`}
        className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-wait disabled:bg-slate-300"
      >
        {avisoVisible ? "Añadido ✓" : "Añadir al carrito"}
      </button>
      {aviso}
    </div>
  );
}
