import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_STATE_INICIAL } from "@/lib/form-state";

vi.mock("@/server/authorization", () => ({
  requerirPersonalTaller: vi.fn(),
  requerirStaff: vi.fn(),
}));

vi.mock("@/server/data/work-logs", () => ({
  cerrarFichajeStaff: vi.fn(),
  corregirFichajeStaff: vi.fn(),
  ficharEntradaGeneral: vi.fn(),
  ficharEntradaReparacion: vi.fn(),
  ficharSalida: vi.fn(),
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
  cerrarFichajeStaffAction,
  corregirFichajeStaffAction,
  ficharEntradaGeneralAction,
  ficharEntradaReparacionAction,
  ficharSalidaAction,
} from "@/server/actions/work-logs";
import { requerirPersonalTaller, requerirStaff } from "@/server/authorization";
import {
  cerrarFichajeStaff,
  corregirFichajeStaff,
  ficharEntradaGeneral,
  ficharEntradaReparacion,
  ficharSalida,
} from "@/server/data/work-logs";

function formulario(valores: Record<string, string>) {
  const data = new FormData();

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

const TRABAJADOR = { id: "worker-1", name: "Trabajador Demo", role: "trabajador" } as const;
const ENCARGADO = { id: "staff-1", name: "Encargado Demo", role: "encargado" } as const;

describe("fichaje del trabajador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requerirPersonalTaller).mockResolvedValue(TRABAJADOR);
    vi.mocked(ficharEntradaReparacion).mockResolvedValue({ ok: true, requestId: "req-1" });
    vi.mocked(ficharEntradaGeneral).mockResolvedValue({ ok: true, requestId: null });
    vi.mocked(ficharSalida).mockResolvedValue({ ok: true, requestId: "req-1" });
  });

  it("ficha entrada en la reparación con el usuario autenticado y vuelve al detalle", async () => {
    await expect(
      ficharEntradaReparacionAction(FORM_STATE_INICIAL, formulario({ requestId: "req-1" })),
    ).rejects.toThrow("REDIRECT:/trabajador/reparaciones/req-1?fichaje=entrada");

    expect(ficharEntradaReparacion).toHaveBeenCalledWith({
      userId: "worker-1",
      requestId: "req-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/trabajador/reparaciones/req-1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/fichajes");
  });

  it("explica el doble fichaje y la reparación no disponible sin redirigir", async () => {
    vi.mocked(ficharEntradaReparacion).mockResolvedValueOnce({ ok: false, motivo: "ya-abierto" });

    const doble = await ficharEntradaReparacionAction(
      FORM_STATE_INICIAL,
      formulario({ requestId: "req-1" }),
    );

    expect(doble).toEqual({
      status: "error",
      message: "Ya tienes un fichaje abierto. Ciérralo antes de fichar de nuevo.",
    });

    vi.mocked(ficharEntradaReparacion).mockResolvedValueOnce({
      ok: false,
      motivo: "reparacion-no-disponible",
    });

    const ajena = await ficharEntradaReparacionAction(
      FORM_STATE_INICIAL,
      formulario({ requestId: "req-ajena" }),
    );

    expect(ajena.message).toContain("reparaciones tuyas");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("encargado y admin no fichan", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue(ENCARGADO);

    const resultado = await ficharEntradaGeneralAction(
      FORM_STATE_INICIAL,
      formulario({ nota: "Inventario" }),
    );

    expect(resultado.message).toBe("Solo los trabajadores fichan.");
    expect(ficharEntradaGeneral).not.toHaveBeenCalled();
  });

  it("horas generales exigen nota antes de llamar a datos", async () => {
    const resultado = await ficharEntradaGeneralAction(
      FORM_STATE_INICIAL,
      formulario({ nota: "   " }),
    );

    expect(resultado.fieldErrors?.nota?.[0]).toBeTruthy();
    expect(ficharEntradaGeneral).not.toHaveBeenCalled();
  });

  it("ficha horas generales y vuelve al inicio", async () => {
    await expect(
      ficharEntradaGeneralAction(FORM_STATE_INICIAL, formulario({ nota: "Inventario" })),
    ).rejects.toThrow("REDIRECT:/trabajador?fichaje=entrada");
  });

  it("la salida vuelve al detalle o al inicio según el origen", async () => {
    await expect(
      ficharSalidaAction(
        FORM_STATE_INICIAL,
        formulario({ workLogId: "wl-1", origen: "reparacion" }),
      ),
    ).rejects.toThrow("REDIRECT:/trabajador/reparaciones/req-1?fichaje=salida");

    await expect(
      ficharSalidaAction(FORM_STATE_INICIAL, formulario({ workLogId: "wl-1", origen: "inicio" })),
    ).rejects.toThrow("REDIRECT:/trabajador?fichaje=salida");

    expect(ficharSalida).toHaveBeenCalledWith({ userId: "worker-1", workLogId: "wl-1" });
  });

  it("explica que el fichaje ya estaba cerrado", async () => {
    vi.mocked(ficharSalida).mockResolvedValue({ ok: false, motivo: "no-abierto" });

    const resultado = await ficharSalidaAction(
      FORM_STATE_INICIAL,
      formulario({ workLogId: "wl-1", origen: "inicio" }),
    );

    expect(resultado.message).toContain("ya estaba cerrado");
  });

  it("no ejecuta nada si el guard rechaza al usuario", async () => {
    vi.mocked(requerirPersonalTaller).mockRejectedValue(new Error("REDIRECT:/app"));

    await expect(
      ficharEntradaReparacionAction(FORM_STATE_INICIAL, formulario({ requestId: "req-1" })),
    ).rejects.toThrow("REDIRECT:/app");
    expect(ficharEntradaReparacion).not.toHaveBeenCalled();
  });
});

describe("cierre y corrección del staff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requerirStaff).mockResolvedValue(ENCARGADO);
    vi.mocked(cerrarFichajeStaff).mockResolvedValue({ ok: true, requestId: "req-1" });
    vi.mocked(corregirFichajeStaff).mockResolvedValue({ ok: true, requestId: "req-1" });
  });

  it("cierra con el staff autenticado y vuelve a la lista de abiertos", async () => {
    await expect(
      cerrarFichajeStaffAction(
        FORM_STATE_INICIAL,
        formulario({ workLogId: "wl-1", origen: "abiertos" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/fichajes?cerrado=1");

    expect(cerrarFichajeStaff).toHaveBeenCalledWith({ actorId: "staff-1", workLogId: "wl-1" });
  });

  it("corrige convirtiendo la hora de Madrid y vuelve a la solicitud", async () => {
    await expect(
      corregirFichajeStaffAction(
        FORM_STATE_INICIAL,
        formulario({
          workLogId: "wl-1",
          origen: "solicitud",
          inicio: "2026-10-20T08:00",
          fin: "2026-10-20T14:30",
          nota: "",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/solicitudes/req-1?fichaje=1");

    expect(corregirFichajeStaff).toHaveBeenCalledWith({
      actorId: "staff-1",
      workLogId: "wl-1",
      inicio: new Date("2026-10-20T06:00:00Z"),
      fin: new Date("2026-10-20T12:30:00Z"),
      nota: "",
    });
  });

  it("muestra el error de campo si la salida es anterior a la entrada", async () => {
    const resultado = await corregirFichajeStaffAction(
      FORM_STATE_INICIAL,
      formulario({
        workLogId: "wl-1",
        origen: "abiertos",
        inicio: "2026-10-20T08:00",
        fin: "2026-10-20T07:00",
      }),
    );

    expect(resultado.fieldErrors?.fin?.[0]).toBe("La salida no puede ser anterior a la entrada");
    expect(corregirFichajeStaff).not.toHaveBeenCalled();
  });

  it("explica que un fichaje cerrado no se reabre", async () => {
    vi.mocked(corregirFichajeStaff).mockResolvedValue({ ok: false, motivo: "no-reabrir" });

    const resultado = await corregirFichajeStaffAction(
      FORM_STATE_INICIAL,
      formulario({ workLogId: "wl-1", origen: "abiertos", inicio: "2026-10-20T08:00" }),
    );

    expect(resultado.message).toContain("no se puede reabrir");
  });

  it("un trabajador no puede cerrar ni corregir", async () => {
    vi.mocked(requerirStaff).mockRejectedValue(new Error("REDIRECT:/app"));

    await expect(
      cerrarFichajeStaffAction(FORM_STATE_INICIAL, formulario({ workLogId: "wl-1" })),
    ).rejects.toThrow("REDIRECT:/app");
    await expect(
      corregirFichajeStaffAction(FORM_STATE_INICIAL, formulario({ workLogId: "wl-1" })),
    ).rejects.toThrow("REDIRECT:/app");
    expect(cerrarFichajeStaff).not.toHaveBeenCalled();
    expect(corregirFichajeStaff).not.toHaveBeenCalled();
  });

  it("tras cerrar o corregir vuelve a la semana y al trabajador filtrados", async () => {
    await expect(
      cerrarFichajeStaffAction(
        FORM_STATE_INICIAL,
        formulario({
          workLogId: "wl-1",
          origen: "abiertos",
          volverA: "/admin/fichajes?semana=2026-10-19&trabajador=worker1",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/fichajes?semana=2026-10-19&trabajador=worker1&cerrado=1");

    await expect(
      corregirFichajeStaffAction(
        FORM_STATE_INICIAL,
        formulario({
          workLogId: "wl-1",
          origen: "abiertos",
          inicio: "2026-10-20T08:00",
          fin: "2026-10-20T09:00",
          volverA: "/admin/fichajes?semana=2026-10-19",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/fichajes?semana=2026-10-19&corregido=1");
  });

  it("ignora una ruta de vuelta externa o de otra página", async () => {
    await expect(
      cerrarFichajeStaffAction(
        FORM_STATE_INICIAL,
        formulario({ workLogId: "wl-1", origen: "abiertos", volverA: "https://evil.example" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/fichajes?cerrado=1");
  });
});
