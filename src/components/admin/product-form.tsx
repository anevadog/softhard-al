"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { FORM_STATE_INICIAL, type FormState } from "@/lib/form-state";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductoEditable,
} from "@/lib/products";
import {
  crearProductoAction,
  editarProductoAction,
} from "@/server/actions/products";

type Campo =
  | "name"
  | "description"
  | "price"
  | "stock"
  | "category"
  | "imageUrl";

const labelClass = "block text-sm font-medium text-slate-700";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;

  return (
    <p id={id} className="mt-1.5 text-xs text-red-600">
      {messages[0]}
    </p>
  );
}

function esUrlHttp(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ProductForm({ producto }: { producto?: ProductoEditable }) {
  const [state, setState] = useState<FormState>(FORM_STATE_INICIAL);
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  const [valores, setValores] = useState<Record<Campo, string>>({
    name: producto?.name ?? "",
    description: producto?.description ?? "",
    price: producto ? producto.price.toFixed(2).replace(".", ",") : "",
    stock: producto ? String(producto.stock) : "0",
    category: producto?.category ?? "ordenadores",
    imageUrl: producto?.imageUrl ?? "",
  });

  const accion: (prev: FormState, formData: FormData) => Promise<FormState> =
    producto ? editarProductoAction : crearProductoAction;

  const imageUrl = valores.imageUrl.trim();
  const imageUrlValida = imageUrl !== "" && esUrlHttp(imageUrl);

  function alCambiar(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setValores((previos) => ({ ...previos, [name as Campo]: value }));
  }

  function alEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // En éxito la acción redirige y esta promesa no vuelve.
      const resultado = await accion(state, formData);

      setState(resultado);
    });
  }

  return (
    <form onSubmit={alEnviar} className="space-y-6" noValidate>
      {producto ? (
        <input type="hidden" name="productId" value={producto.id} />
      ) : null}

      {state.status === "error" && state.message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="name" className={labelClass}>
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          maxLength={80}
          placeholder="Portátil Lenovo ThinkPad T14"
          autoComplete="off"
          value={valores.name}
          onChange={alCambiar}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={inputClass}
        />
        <FieldError id="name-error" messages={errors.name} />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="Características principales del producto…"
          value={valores.description}
          onChange={alCambiar}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "description-error" : "description-hint"}
          className={inputClass}
        />
        {errors.description ? (
          <FieldError id="description-error" messages={errors.description} />
        ) : (
          <p id="description-hint" className="mt-1.5 text-xs text-slate-500">
            Mínimo 10 caracteres. Se mostrará en el catálogo.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className={labelClass}>
            Precio (€)
          </label>
          <input
            id="price"
            name="price"
            type="text"
            inputMode="decimal"
            placeholder="49,90"
            autoComplete="off"
            value={valores.price}
            onChange={alCambiar}
            aria-invalid={Boolean(errors.price)}
            aria-describedby={errors.price ? "price-error" : "price-hint"}
            className={inputClass}
          />
          {errors.price ? (
            <FieldError id="price-error" messages={errors.price} />
          ) : (
            <p id="price-hint" className="mt-1.5 text-xs text-slate-500">
              Mayor que 0 €. Admite coma o punto y hasta dos decimales.
            </p>
          )}
        </div>

        {producto ? (
          <div>
            <p className={labelClass}>Stock actual</p>
            <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {producto.stock}{" "}
              {producto.stock === 1 ? "unidad" : "unidades"}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Se modifica desde el ajuste de stock, no desde esta edición.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="stock" className={labelClass}>
              Stock
            </label>
            <input
              id="stock"
              name="stock"
              type="number"
              min={0}
              max={999999}
              step={1}
              value={valores.stock}
              onChange={alCambiar}
              aria-invalid={Boolean(errors.stock)}
              aria-describedby={errors.stock ? "stock-error" : "stock-hint"}
              className={inputClass}
            />
            {errors.stock ? (
              <FieldError id="stock-error" messages={errors.stock} />
            ) : (
              <p id="stock-hint" className="mt-1.5 text-xs text-slate-500">
                Número entero de unidades disponibles.
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="category" className={labelClass}>
          Categoría
        </label>
        <select
          id="category"
          name="category"
          value={valores.category}
          onChange={alCambiar}
          aria-invalid={Boolean(errors.category)}
          aria-describedby={errors.category ? "category-error" : undefined}
          className={inputClass}
        >
          {PRODUCT_CATEGORIES.map((categoria) => (
            <option key={categoria} value={categoria}>
              {PRODUCT_CATEGORY_LABELS[categoria]}
            </option>
          ))}
        </select>
        <FieldError id="category-error" messages={errors.category} />
      </div>

      <div>
        <label htmlFor="imageUrl" className={labelClass}>
          URL de la imagen <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          maxLength={500}
          placeholder="https://example.com/producto.jpg"
          autoComplete="off"
          value={valores.imageUrl}
          onChange={alCambiar}
          aria-invalid={Boolean(errors.imageUrl)}
          aria-describedby={errors.imageUrl ? "imageUrl-error" : "imageUrl-hint"}
          className={inputClass}
        />
        {errors.imageUrl ? (
          <FieldError id="imageUrl-error" messages={errors.imageUrl} />
        ) : (
          <p id="imageUrl-hint" className="mt-1.5 text-xs text-slate-500">
            Si se deja vacía se mostrará una imagen de relleno.
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {imageUrlValida ? (
              <img
                src={imageUrl}
                alt="Vista previa del producto"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="px-2 text-center text-[10px] text-slate-400">
                Sin vista previa
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Se actualiza al pegar una URL http(s) válida.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          {pending
            ? "Guardando…"
            : producto
              ? "Guardar cambios"
              : "Crear producto"}
        </button>
        <Link
          href="/admin/productos"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
