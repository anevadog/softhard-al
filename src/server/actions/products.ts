"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import {
  productCreateSchema,
  productEditSchema,
  productIdSchema,
} from "@/lib/validations/product";
import { stockAdjustmentSchema } from "@/lib/validations/stock";
import { requerirStaff } from "@/server/authorization";
import {
  actualizarProducto,
  archivarProducto,
  crearProducto,
} from "@/server/data/products";
import { ajustarStockProducto } from "@/server/data/stock";

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

  const parsed = productCreateSchema.safeParse(camposProducto(formData));

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

  const parsed = productEditSchema.safeParse(camposProducto(formData));

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
  revalidatePath(`/productos/${parsedId.data}`);
  redirect("/admin/productos?actualizado=1");
}

export async function ajustarStockAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requerirStaff();

  const parsed = stockAdjustmentSchema.safeParse({
    productId: formData.get("productId"),
    reason: formData.get("reason"),
    variation: formData.get("variation"),
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      status: "error",
      message: "Revisa los datos del ajuste de stock.",
      fieldErrors,
    };
  }

  try {
    const resultado = await ajustarStockProducto({
      ...parsed.data,
      userId: staff.id,
    });

    if (!resultado.ok) {
      return {
        status: "error",
        message:
          resultado.motivo === "stock-insuficiente"
            ? "El ajuste dejaría el stock en negativo. Revisa la variación."
            : "El producto no existe o está archivado.",
      };
    }
  } catch (error) {
    console.error("Error ajustando stock:", error);

    return {
      status: "error",
      message: "No se pudo ajustar el stock. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/admin/productos");
  revalidatePath(`/admin/productos/${parsed.data.productId}`);
  revalidatePath("/productos");
  revalidatePath(`/productos/${parsed.data.productId}`);
  redirect(`/admin/productos/${parsed.data.productId}?ajuste=1`);
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
