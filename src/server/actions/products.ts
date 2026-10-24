"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import { productIdSchema, productSchema } from "@/lib/validations/product";
import { requerirStaff } from "@/server/authorization";
import {
  actualizarProducto,
  archivarProducto,
  crearProducto,
} from "@/server/data/products";

function camposProducto(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    category: formData.get("category"),
    imageUrl: formData.get("imageUrl"),
  };
}

export async function crearProductoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requerirStaff();

  const parsed = productSchema.safeParse(camposProducto(formData));

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa los datos del producto.",
      fieldErrors,
    };
  }

  try {
    await crearProducto(parsed.data);
  } catch (error) {
    console.error("Error creando producto:", error);

    return {
      status: "error",
      message: "No se pudo crear el producto. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/productos");
  redirect("/admin/productos?creado=1");
}

export async function editarProductoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requerirStaff();

  const parsedId = productIdSchema.safeParse(formData.get("productId"));

  if (!parsedId.success) {
    return { status: "error", message: "Producto no válido." };
  }

  const parsed = productSchema.safeParse(camposProducto(formData));

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa los datos del producto.",
      fieldErrors,
    };
  }

  try {
    const actualizado = await actualizarProducto(parsedId.data, parsed.data);

    if (!actualizado) {
      return {
        status: "error",
        message: "El producto ya no existe o está archivado.",
      };
    }
  } catch (error) {
    console.error("Error actualizando producto:", error);

    return {
      status: "error",
      message: "No se pudo actualizar el producto. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${parsedId.data}`);
  revalidatePath("/productos");
  redirect("/admin/productos?actualizado=1");
}

export async function borrarProductoAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requerirStaff();

  const parsedId = productIdSchema.safeParse(formData.get("productId"));

  if (!parsedId.success) {
    return { status: "error", message: "Producto no válido." };
  }

  try {
    const archivado = await archivarProducto(parsedId.data);

    if (!archivado) {
      return {
        status: "error",
        message: "El producto ya no existe o está archivado.",
      };
    }
  } catch (error) {
    console.error("Error archivando producto:", error);

    return {
      status: "error",
      message: "No se pudo borrar el producto. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/productos");
  redirect("/admin/productos?borrado=1");
}
