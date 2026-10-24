import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_STATE_INICIAL } from "@/lib/form-state";

vi.mock("@/server/authorization", () => ({
  requerirStaff: vi.fn(),
}));

vi.mock("@/server/data/products", () => ({
  crearProducto: vi.fn(),
  actualizarProducto: vi.fn(),
  archivarProducto: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import {
  borrarProductoAction,
  crearProductoAction,
  editarProductoAction,
} from "@/server/actions/products";
import { requerirStaff } from "@/server/authorization";
import {
  actualizarProducto,
  archivarProducto,
  crearProducto,
} from "@/server/data/products";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID = {
  name: "Teclado mecánico Keychron K2",
  description: "Teclado inalámbrico con retroiluminación y switches táctiles.",
  price: "49,90",
  stock: "12",
  category: "accesorios",
  imageUrl: "",
};

function formulario(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const valores = { ...VALID, ...overrides };

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

describe("acciones de productos", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requerirStaff).mockResolvedValue({
      id: "staff-1",
      name: "Encargado Demo",
      role: "encargado",
    });
    vi.mocked(crearProducto).mockResolvedValue({ id: "prod-1" });
    vi.mocked(actualizarProducto).mockResolvedValue(true);
    vi.mocked(archivarProducto).mockResolvedValue(true);
  });

  it("crea un producto válido, revalida y redirige", async () => {
    await expect(
      crearProductoAction(FORM_STATE_INICIAL, formulario()),
    ).rejects.toThrow("REDIRECT:/admin/productos?creado=1");

    expect(requerirStaff).toHaveBeenCalledTimes(1);
    expect(crearProducto).toHaveBeenCalledWith(
      expect.objectContaining({
        name: VALID.name,
        description: VALID.description,
        price: 49.9,
        stock: 12,
        category: "accesorios",
        imageUrl: null,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/productos");
    expect(revalidatePath).toHaveBeenCalledWith("/productos");
    expect(redirect).toHaveBeenCalledWith("/admin/productos?creado=1");
  });

  it("recorta espacios antes de guardar", async () => {
    await expect(
      crearProductoAction(
        FORM_STATE_INICIAL,
        formulario({ name: "  Teclado  " }),
      ),
    ).rejects.toThrow("REDIRECT");

    expect(crearProducto).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Teclado" }),
    );
  });

  it("no escribe si el precio es inválido", async () => {
    const resultado = await crearProductoAction(
      FORM_STATE_INICIAL,
      formulario({ price: "-5" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.fieldErrors?.price?.[0]).toBeTruthy();
    expect(crearProducto).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("no escribe si el stock no es entero", async () => {
    const resultado = await crearProductoAction(
      FORM_STATE_INICIAL,
      formulario({ stock: "1.5" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.fieldErrors?.stock?.[0]).toBeTruthy();
    expect(crearProducto).not.toHaveBeenCalled();
  });

  it("devuelve un error genérico si falla la base de datos al crear", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(crearProducto).mockRejectedValue(new Error("boom"));

    const resultado = await crearProductoAction(
      FORM_STATE_INICIAL,
      formulario(),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("No se pudo crear");
    expect(redirect).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("edita un producto válido y redirige", async () => {
    await expect(
      editarProductoAction(
        FORM_STATE_INICIAL,
        formulario({ productId: "prod-1" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/productos?actualizado=1");

    expect(actualizarProducto).toHaveBeenCalledWith(
      "prod-1",
      expect.objectContaining({
        name: VALID.name,
        price: 49.9,
        stock: 12,
        imageUrl: null,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/productos");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/productos/prod-1");
    expect(revalidatePath).toHaveBeenCalledWith("/productos");
    expect(redirect).toHaveBeenCalledWith(
      "/admin/productos?actualizado=1",
    );
  });

  it("rechaza una edición sin identificador", async () => {
    const resultado = await editarProductoAction(
      FORM_STATE_INICIAL,
      formulario({ productId: "" }),
    );

    expect(resultado).toMatchObject({
      status: "error",
      message: "Producto no válido.",
    });
    expect(actualizarProducto).not.toHaveBeenCalled();
  });

  it("informa si el producto a editar ya no existe", async () => {
    vi.mocked(actualizarProducto).mockResolvedValue(false);

    const resultado = await editarProductoAction(
      FORM_STATE_INICIAL,
      formulario({ productId: "prod-inexistente" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("ya no existe");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("archiva un producto y redirige", async () => {
    await expect(
      borrarProductoAction(
        FORM_STATE_INICIAL,
        formulario({ productId: "prod-1" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/productos?borrado=1");

    expect(archivarProducto).toHaveBeenCalledWith("prod-1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/productos");
    expect(revalidatePath).toHaveBeenCalledWith("/productos");
    expect(redirect).toHaveBeenCalledWith("/admin/productos?borrado=1");
  });

  it("no archiva si el producto no existe", async () => {
    vi.mocked(archivarProducto).mockResolvedValue(false);

    const resultado = await borrarProductoAction(
      FORM_STATE_INICIAL,
      formulario({ productId: "prod-inexistente" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("ya no existe");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("no ejecuta la acción si el usuario no es staff", async () => {
    vi.mocked(requerirStaff).mockRejectedValue(
      new Error("REDIRECT:/login?callbackUrl=/admin/solicitudes"),
    );

    await expect(
      crearProductoAction(FORM_STATE_INICIAL, formulario()),
    ).rejects.toThrow("REDIRECT:/login");

    expect(crearProducto).not.toHaveBeenCalled();
  });
});
