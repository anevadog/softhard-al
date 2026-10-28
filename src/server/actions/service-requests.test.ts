import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_STATE_INICIAL } from "@/lib/form-state";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/data/service-requests", () => ({
  crearSolicitudCliente: vi.fn(),
  decidirPresupuestoCliente: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { auth } from "@/lib/auth";
import { crearSolicitudAction } from "@/server/actions/service-requests";
import { crearSolicitudCliente } from "@/server/data/service-requests";

const SOLICITUD = {
  equipmentType: "portatil",
  brand: "Lenovo",
  model: "T14",
  issue: "No arranca después de la última actualización.",
  modality: "domicilio",
  timeSlot: "manana",
  address: "  Calle de Ejemplo 12, Madrid  ",
};

function formulario(valores: Record<string, string>) {
  const data = new FormData();

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

describe("crearSolicitudAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "client-1" } } as never);
    vi.mocked(crearSolicitudCliente).mockResolvedValue({ id: "req-1" });
  });

  it("guarda la dirección recortada en recogida a domicilio", async () => {
    await expect(
      crearSolicitudAction(FORM_STATE_INICIAL, formulario(SOLICITUD)),
    ).rejects.toThrow("REDIRECT:/app/solicitudes?creada=1");

    expect(crearSolicitudCliente).toHaveBeenCalledWith(
      "client-1",
      expect.objectContaining({ modality: "domicilio", address: "Calle de Ejemplo 12, Madrid" }),
    );
  });

  it("sin dirección en domicilio devuelve el error del campo y no crea nada", async () => {
    const resultado = await crearSolicitudAction(
      FORM_STATE_INICIAL,
      formulario({ ...SOLICITUD, address: "" }),
    );

    expect(resultado.fieldErrors?.address?.[0]).toBe("Indica la dirección de recogida");
    expect(crearSolicitudCliente).not.toHaveBeenCalled();
  });

  it("en taller descarta la dirección aunque llegue en la petición", async () => {
    await expect(
      crearSolicitudAction(FORM_STATE_INICIAL, formulario({ ...SOLICITUD, modality: "taller" })),
    ).rejects.toThrow("REDIRECT:");

    expect(crearSolicitudCliente).toHaveBeenCalledWith(
      "client-1",
      expect.objectContaining({ modality: "taller", address: null }),
    );
  });
});
