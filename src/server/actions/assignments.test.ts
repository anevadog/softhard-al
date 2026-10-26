import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_STATE_INICIAL } from "@/lib/form-state";

vi.mock("@/server/authorization", () => ({
  requerirPersonalTaller: vi.fn(),
  requerirStaff: vi.fn(),
}));

vi.mock("@/server/data/assignments", () => ({
  asignarSolicitudStaff: vi.fn(),
  devolverSolicitudTrabajador: vi.fn(),
  tomarSolicitudTrabajador: vi.fn(),
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

import {
  asignarSolicitudAction,
  devolverSolicitudAction,
  tomarSolicitudAction,
} from "@/server/actions/assignments";
import {
  requerirPersonalTaller,
  requerirStaff,
} from "@/server/authorization";
import {
  asignarSolicitudStaff,
  devolverSolicitudTrabajador,
  tomarSolicitudTrabajador,
} from "@/server/data/assignments";

function formularioAsignacion(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const valores = {
    requestId: "req-1",
    assigneeId: "worker-1",
    assigneeEsperadoId: "",
    motivo: "",
    ...overrides,
  };

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

function formularioToma() {
  const data = new FormData();
  data.set("requestId", "req-1");
  return data;
}

function formularioDevolucion(motivo = "Falta la pieza") {
  const data = new FormData();
  data.set("requestId", "req-1");
  data.set("motivo", motivo);
  return data;
}

describe("asignarSolicitudAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requerirStaff).mockResolvedValue({
      id: "staff-1",
      name: "Encargado Demo",
      role: "encargado",
    });
    vi.mocked(asignarSolicitudStaff).mockResolvedValue({ ok: true });
  });

  it("asigna con el staff autenticado, revalida y redirige", async () => {
    await expect(
      asignarSolicitudAction(FORM_STATE_INICIAL, formularioAsignacion()),
    ).rejects.toThrow("REDIRECT:/admin/solicitudes/req-1?asignacion=1");

    expect(asignarSolicitudStaff).toHaveBeenCalledWith({
      requestId: "req-1",
      assigneeId: "worker-1",
      assigneeEsperadoId: null,
      actorId: "staff-1",
      motivo: "",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes/req-1");
    expect(revalidatePath).toHaveBeenCalledWith("/trabajador");
  });

  it("convierte el responsable esperado vacío en null", async () => {
    await expect(
      asignarSolicitudAction(
        FORM_STATE_INICIAL,
        formularioAsignacion({ assigneeEsperadoId: "" }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(asignarSolicitudStaff).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeEsperadoId: null }),
    );
  });

  it("rechaza un formulario sin trabajador antes de llamar a datos", async () => {
    const resultado = await asignarSolicitudAction(
      FORM_STATE_INICIAL,
      formularioAsignacion({ assigneeId: "" }),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.fieldErrors?.assigneeId?.[0]).toBeTruthy();
    expect(asignarSolicitudStaff).not.toHaveBeenCalled();
  });

  it("muestra el bloqueo de estados finales", async () => {
    vi.mocked(asignarSolicitudStaff).mockResolvedValue({
      ok: false,
      motivo: "estado-final",
    });

    const resultado = await asignarSolicitudAction(
      FORM_STATE_INICIAL,
      formularioAsignacion(),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("estado final");
  });

  it("no ejecuta nada si el guard rechaza al usuario", async () => {
    vi.mocked(requerirStaff).mockRejectedValue(new Error("REDIRECT:/app"));

    await expect(
      asignarSolicitudAction(FORM_STATE_INICIAL, formularioAsignacion()),
    ).rejects.toThrow("REDIRECT:/app");

    expect(asignarSolicitudStaff).not.toHaveBeenCalled();
  });
});

describe("tomarSolicitudAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requerirPersonalTaller).mockResolvedValue({
      id: "worker-1",
      name: "Trabajador Demo",
      role: "trabajador",
    });
    vi.mocked(tomarSolicitudTrabajador).mockResolvedValue({ ok: true });
  });

  it("toma la reparación con el trabajador autenticado", async () => {
    await expect(
      tomarSolicitudAction(FORM_STATE_INICIAL, formularioToma()),
    ).rejects.toThrow("REDIRECT:/trabajador/reparaciones/req-1?tomada=1");

    expect(tomarSolicitudTrabajador).toHaveBeenCalledWith({
      requestId: "req-1",
      actorId: "worker-1",
      actorRol: "trabajador",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/trabajador");
    expect(revalidatePath).toHaveBeenCalledWith("/trabajador/reparaciones/req-1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes/req-1");
  });

  it("muestra un mensaje claro si ya no está disponible", async () => {
    vi.mocked(tomarSolicitudTrabajador).mockResolvedValue({
      ok: false,
      motivo: "no-disponible",
    });

    const resultado = await tomarSolicitudAction(
      FORM_STATE_INICIAL,
      formularioToma(),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("disponible");
  });

  it("impide que el staff tome una reparación", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue({
      id: "staff-1",
      name: "Encargado Demo",
      role: "encargado",
    });
    vi.mocked(tomarSolicitudTrabajador).mockResolvedValue({
      ok: false,
      motivo: "no-autorizado",
    });

    const resultado = await tomarSolicitudAction(
      FORM_STATE_INICIAL,
      formularioToma(),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("permiso");
  });
});

describe("devolverSolicitudAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requerirPersonalTaller).mockResolvedValue({
      id: "worker-1",
      name: "Trabajador Demo",
      role: "trabajador",
    });
    vi.mocked(devolverSolicitudTrabajador).mockResolvedValue({ ok: true });
  });

  it("devuelve con motivo obligatorio y redirige a taller", async () => {
    await expect(
      devolverSolicitudAction(FORM_STATE_INICIAL, formularioDevolucion()),
    ).rejects.toThrow("REDIRECT:/trabajador?devuelta=1");

    expect(devolverSolicitudTrabajador).toHaveBeenCalledWith({
      requestId: "req-1",
      actorId: "worker-1",
      actorRol: "trabajador",
      motivo: "Falta la pieza",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/trabajador");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes/req-1");
  });

  it("rechaza un motivo vacío antes de llamar a datos", async () => {
    const resultado = await devolverSolicitudAction(
      FORM_STATE_INICIAL,
      formularioDevolucion("   "),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.fieldErrors?.motivo?.[0]).toBeTruthy();
    expect(devolverSolicitudTrabajador).not.toHaveBeenCalled();
  });

  it("informa de un conflicto sin redirigir", async () => {
    vi.mocked(devolverSolicitudTrabajador).mockResolvedValue({
      ok: false,
      motivo: "conflicto",
    });

    const resultado = await devolverSolicitudAction(
      FORM_STATE_INICIAL,
      formularioDevolucion(),
    );

    expect(resultado.status).toBe("error");
    expect(resultado.message).toContain("cambiado");
  });

  it("trata una reparación ajena igual que una inexistente", async () => {
    vi.mocked(devolverSolicitudTrabajador).mockResolvedValue({
      ok: false,
      motivo: "no-existe",
    });

    const resultado = await devolverSolicitudAction(
      FORM_STATE_INICIAL,
      formularioDevolucion(),
    );

    expect(resultado).toEqual({
      status: "error",
      message: "La reparación ya no existe.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
