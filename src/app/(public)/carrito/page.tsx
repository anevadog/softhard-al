import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";
import { SectionHeading } from "@/components/site/section-heading";

export const metadata: Metadata = {
  title: "Carrito",
  description:
    "Revisa los productos de tu carrito, ajusta cantidades y consulta el total antes de finalizar la compra.",
};

export default function CarritoPage() {
  return (
    <div className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <SectionHeading
            as="h1"
            align="left"
            eyebrow="Tienda"
            title="Tu carrito"
            description="Revisa los productos, ajusta las cantidades y comprueba el total antes de finalizar."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <CartView />
      </section>
    </div>
  );
}
