import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_STATE_INICIAL } from "@/lib/form-state";

vi.mock("@/server/authorization", () => ({
  requerirPersonalTaller: vi.fn(),
  requerirStaff: vi.fn(),
}));

vi.mock("@/server/data/admin-requests", () => ({
  crearPresupuesto: vi.fn(),
  obtenerConfig: vi.fn(),
}));

vi.mock("@/server/data/service-status", () => ({
  cambiarEstadoSolicitud: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  cambiarEstadoAction,
  crearPresupuestoAction,
} from "@/server/actions/admin-requests";
import {
  requerirPersonalTaller,
  requerirStaff,
} from "@/server/authorization";
import {
  crearPresupuesto,
  obtenerConfig,
} from "@/server/data/admin-requests";
import { cambiarEstadoSolicitud } from "@/server/data/service-status";

function formularioEstado(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const valores = {
    requestId: "req-1",
    estadoEsperado: "aceptada",
    estadoNuevo: "en_reparacion",
    motivo: "",
    ...overrides,
  };

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

function formularioPresupuesto() {
  const data = new FormData();
  data.set("requestId", "req-1");
  data.set("budgetAmount", "120,50");
  return data;
}

describe("cambiarEstadoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requerirPersonalTaller).mockResolvedValue({
      id: "staff-1",
      name: "Encargado Demo",
      role: "encargado",
    });
    vi.mocked(requerirStaff).mockResolvedValue({
      id: "staff-1",
      name: "Encargado Demo",
      role: "encargado",
    });
    vi.mocked(cambiarEstadoSolicitud).mockResolvedValue({ ok: true });
  });

  it("cambia el estado con el rol revalidado y redirige al panel", async () => {
    await expect(
      cambiarEstadoAction(FORM_STATE_INICIAL, formularioEstado()),
    ).rejects.toThrow("REDIRECT:/admin/solicitudes/req-1?estado=1");

    expect(cambiarEstadoSolicitud).toHaveBeenCalledWith({
      requestId: "req-1",
      estadoEsperado: "aceptada",
      estadoNuevo: "en_reparacion",
      actorId: "staff-1",
      rol: "encargado",
      motivo: "",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes/req-1");
    expect(revalidatePath).toHaveBeenCalledWith("/app/solicitudes");
    expect(revalidatePath).toHaveBeenCalledWith("/app/solicitudes/req-1");
    expect(revalidatePath).toHaveBeenCalledWith("/trabajador");
    expect(redirect).toHaveBeenCalledWith(
      "/admin/solicitudes/req-1?estado=1",
    );
  });

  it("redirige a taller cuando el actor es trabajador", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue({
      id: "worker-1",
      name: "Trabajador Demo",
      role: "trabajador",
    });

    await expect(
      cambiarEstadoAction(FORM_STATE_INICIAL, formularioEstado()),
    ).rejects.toThrow("REDIRECT:/trabajador/reparaciones/req-1?estado=1");

    expect(revalidatePath).toHaveBeenCalledWith("/trabajador/reparaciones/req-1");

    expect(cambiarEstadoSolicitud).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "worker-1",
        rol: "trabajador",
      }),
    );
  });

  it("rechaza estados inventados antes de llamar a datos", async () => {
    const resultado = await cambiarEstadoAction(
      FORM_STATE_INICIAL,
      formularioEstado({ estadoNuevo: "cancelada" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.fieldErrors?.estadoNuevo?.[0]).toBeTruthy();
    expect(cambiarEstadoSolicitud).not.toHaveBeenCalled();
  });

  it("muestra el error de motivo obligatorio devuelto por la capa de datos", async () => {
    vi.mocked(cambiarEstadoSolicitud).mockResolvedValue({
      ok: false,
      motivo: "motivo-obligatorio",
    });

    const resultado = await cambiarEstadoAction(
      FORM_STATE_INICIAL,
      formularioEstado({ estadoEsperado: "entregada", estadoNuevo: "pendiente" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("motivo");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("informa de un conflicto sin redirigir", async () => {
    vi.mocked(cambiarEstadoSolicitud).mockResolvedValue({
      ok: false,
      motivo: "conflicto",
    });

    const resultado = await cambiarEstadoAction(
      FORM_STATE_INICIAL,
      formularioEstado(),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("cambiado");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("un trabajador recibe la misma respuesta para una reparación ajena que para una inexistente", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue({
      id: "worker-2",
      name: "Otro Trabajador",
      role: "trabajador",
    });
    vi.mocked(cambiarEstadoSolicitud).mockResolvedValue({
      ok: false,
      motivo: "no-existe",
    });

    const resultado = await cambiarEstadoAction(
      FORM_STATE_INICIAL,
      formularioEstado(),
    );

    expect(resultado).toEqual({
      status: "error",
      message: "La solicitud ya no existe.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("explica que un salto de flujo no está permitido", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue({
      id: "worker-1",
      name: "Trabajador Demo",
      role: "trabajador",
    });
    vi.mocked(cambiarEstadoSolicitud).mockResolvedValue({
      ok: false,
      motivo: "transicion-invalida",
    });

    const resultado = await cambiarEstadoAction(
      FORM_STATE_INICIAL,
      formularioEstado({ estadoNuevo: "entregada" }),
    );

    expect(resultado.message).toBe("Ese cambio no está permitido.");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("no ejecuta nada si el guard rechaza al usuario", async () => {
    vi.mocked(requerirPersonalTaller).mockRejectedValue(
      new Error("REDIRECT:/app"),
    );

    await expect(
      cambiarEstadoAction(FORM_STATE_INICIAL, formularioEstado()),
    ).rejects.toThrow("REDIRECT:/app");

    expect(cambiarEstadoSolicitud).not.toHaveBeenCalled();
  });
});

describe("crearPresupuestoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requerirStaff).mockResolvedValue({
      id: "staff-1",
      name: "Encargado Demo",
      role: "encargado",
    });
    vi.mocked(obtenerConfig).mockResolvedValue({
      diagnosticFee: 20,
      expirationDays: 7,
    });
    vi.mocked(crearPresupuesto).mockResolvedValue({
      ok: true,
      quoteId: "quote-1",
    });
  });

  it("atribuye el presupuesto al staff autenticado", async () => {
    await expect(
      crearPresupuestoAction(FORM_STATE_INICIAL, formularioPresupuesto()),
    ).rejects.toThrow("REDIRECT:/admin/solicitudes/req-1?presupuesto=1");

    expect(crearPresupuesto).toHaveBeenCalledWith({
      requestId: "req-1",
      budgetAmount: 120.5,
      diagnosticFee: 20,
      finalAmount: 100.5,
      expiresAt: expect.any(Date),
      userId: "staff-1",
    });
  });
});
