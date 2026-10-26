import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_STATE_INICIAL } from "@/lib/form-state";

vi.mock("@/server/authorization", () => ({
  requerirPersonalTaller: vi.fn(),
  requerirStaff: vi.fn(),
}));

vi.mock("@/server/data/request-notes", () => ({
  crearNotaStaff: vi.fn(),
  crearNotaTrabajador: vi.fn(),
  marcarNotaAtendida: vi.fn(),
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

import { crearNotaAction, marcarNotaAtendidaAction } from "@/server/actions/request-notes";
import { requerirPersonalTaller, requerirStaff } from "@/server/authorization";
import {
  crearNotaStaff,
  crearNotaTrabajador,
  marcarNotaAtendida,
} from "@/server/data/request-notes";

function formulario(valores: Record<string, string>) {
  const data = new FormData();

  for (const [campo, valor] of Object.entries(valores)) {
    data.set(campo, valor);
  }

  return data;
}

const NOTA = { requestId: "req-1", tipo: "falta_repuesto", texto: "Falta la pantalla" };
const TRABAJADOR = { id: "worker-1", name: "Trabajador Demo", role: "trabajador" } as const;
const ENCARGADO = { id: "staff-1", name: "Encargado Demo", role: "encargado" } as const;

describe("crearNotaAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(crearNotaTrabajador).mockResolvedValue({ ok: true, requestId: "req-1" });
    vi.mocked(crearNotaStaff).mockResolvedValue({ ok: true, requestId: "req-1" });
  });

  it("el trabajador crea la nota con su usuario y vuelve a su detalle", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue(TRABAJADOR);

    await expect(crearNotaAction(FORM_STATE_INICIAL, formulario(NOTA))).rejects.toThrow(
      "REDIRECT:/trabajador/reparaciones/req-1?nota=1",
    );

    expect(crearNotaTrabajador).toHaveBeenCalledWith({
      userId: "worker-1",
      requestId: "req-1",
      tipo: "falta_repuesto",
      texto: "Falta la pantalla",
    });
    expect(crearNotaStaff).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/solicitudes");
  });

  it("el staff crea la nota con sus reglas y vuelve al detalle del panel", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue(ENCARGADO);

    await expect(crearNotaAction(FORM_STATE_INICIAL, formulario(NOTA))).rejects.toThrow(
      "REDIRECT:/admin/solicitudes/req-1?nota=1",
    );

    expect(crearNotaStaff).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "staff-1", requestId: "req-1" }),
    );
    expect(crearNotaTrabajador).not.toHaveBeenCalled();
  });

  it("explica que la reparación ya no es suya sin redirigir", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue(TRABAJADOR);
    vi.mocked(crearNotaTrabajador).mockResolvedValue({ ok: false, motivo: "no-disponible" });

    const resultado = await crearNotaAction(FORM_STATE_INICIAL, formulario(NOTA));

    expect(resultado.message).toContain("no es tuya o está cerrada");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("valida el texto antes de llamar a datos", async () => {
    vi.mocked(requerirPersonalTaller).mockResolvedValue(TRABAJADOR);

    const resultado = await crearNotaAction(
      FORM_STATE_INICIAL,
      formulario({ ...NOTA, texto: "  " }),
    );

    expect(resultado.fieldErrors?.texto?.[0]).toBeTruthy();
    expect(crearNotaTrabajador).not.toHaveBeenCalled();
  });

  it("no ejecuta nada si el guard rechaza al usuario", async () => {
    vi.mocked(requerirPersonalTaller).mockRejectedValue(new Error("REDIRECT:/app"));

    await expect(crearNotaAction(FORM_STATE_INICIAL, formulario(NOTA))).rejects.toThrow(
      "REDIRECT:/app",
    );
    expect(crearNotaTrabajador).not.toHaveBeenCalled();
    expect(crearNotaStaff).not.toHaveBeenCalled();
  });
});

describe("marcarNotaAtendidaAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requerirStaff).mockResolvedValue(ENCARGADO);
    vi.mocked(marcarNotaAtendida).mockResolvedValue({ ok: true, requestId: "req-1" });
  });

  it("marca la nota con el staff autenticado y vuelve al detalle", async () => {
    await expect(
      marcarNotaAtendidaAction(FORM_STATE_INICIAL, formulario({ noteId: "n-1" })),
    ).rejects.toThrow("REDIRECT:/admin/solicitudes/req-1?nota=atendida");

    expect(marcarNotaAtendida).toHaveBeenCalledWith({ actorId: "staff-1", noteId: "n-1" });
  });

  it("explica que ya estaba atendida", async () => {
    vi.mocked(marcarNotaAtendida).mockResolvedValue({ ok: false, motivo: "ya-atendida" });

    const resultado = await marcarNotaAtendidaAction(
      FORM_STATE_INICIAL,
      formulario({ noteId: "n-1" }),
    );

    expect(resultado.message).toBe("La falta de repuesto ya estaba atendida.");
  });

  it("un trabajador no puede marcar notas como atendidas", async () => {
    vi.mocked(requerirStaff).mockRejectedValue(new Error("REDIRECT:/app"));

    await expect(
      marcarNotaAtendidaAction(FORM_STATE_INICIAL, formulario({ noteId: "n-1" })),
    ).rejects.toThrow("REDIRECT:/app");
    expect(marcarNotaAtendida).not.toHaveBeenCalled();
  });
});
