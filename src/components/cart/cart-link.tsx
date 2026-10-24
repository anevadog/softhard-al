"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/cart-provider";
import { ShoppingCartIcon } from "@/components/site/icons";

export function CartLink() {
  const { totalUnidades, hidratado } = useCart();
  const cantidad = hidratado ? totalUnidades : 0;
  const etiqueta =
    cantidad === 0
      ? "Carrito vacío"
      : `Carrito, ${cantidad} ${cantidad === 1 ? "unidad" : "unidades"}`;

  return (
    <Link
      href="/carrito"
      aria-label={etiqueta}
      className="relative flex size-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
    >
      <ShoppingCartIcon className="size-5" />
      {cantidad > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-slate-950 px-1 text-[10px] font-semibold leading-4.5 text-white"
        >
          {cantidad > 99 ? "99+" : cantidad}
        </span>
      ) : null}
    </Link>
  );
}
