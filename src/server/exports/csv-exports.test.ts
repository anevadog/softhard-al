import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requerirStaff: vi.fn(),
  filasIngresos: vi.fn(),
  filasPedidos: vi.fn(),
  filasReparaciones: vi.fn(),
}));

vi.mock("@/server/authorization", () => ({ requerirStaff: mocks.requerirStaff }));
vi.mock("@/server/data/exports", () => ({
  filasIngresos: mocks.filasIngresos,
  filasPedidos: mocks.filasPedidos,
  filasReparaciones: mocks.filasReparaciones,
}));

const { GET: getIngresos } = await import("@/app/admin/exportar/ingresos.csv/route");
const { GET: getFacturas } = await import("@/app/admin/exportar/facturas.csv/route");
const { GET: getPedidos } = await import("@/app/admin/exportar/pedidos.csv/route");

const peticion = (ruta: string, query: string) => new Request(`http://localhost${ruta}?${query}`);

const factura = {
  code: "RECT-2026-0001",
  series: "RECT",
  kind: "rectificativa",
  isBackfill: false,
  concept: "venta",
  issuedAt: new Date("2026-10-10T10:00:00Z"),
  mode: "simplificada",
  customerName: "=Cliente raro",
  customerEmail: "c@demo.local",
  baseTotal: "-148.76",
  vatTotal: "-31.24",
  total: "-180.00",
  rectifies: { code: "FAC-2026-0001" },
  replaces: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requerirStaff.mockResolvedValue({ id: "staff", name: "Encargado", role: "encargado" });
});

describe("route handlers de exportación", () => {
  it("revalidan el rol antes de nada: si el guard redirige, no consultan", async () => {
    mocks.requerirStaff.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(getIngresos(peticion("/admin/exportar/ingresos.csv", "desde=2026-10-01&hasta=2026-10-31"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.filasIngresos).not.toHaveBeenCalled();
  });

  it("400 sin rango o con más de 366 días", async () => {
    const sinRango = await getPedidos(peticion("/admin/exportar/pedidos.csv", ""));
    expect(sinRango.status).toBe(400);

    const largo = await getPedidos(peticion("/admin/exportar/pedidos.csv", "desde=2024-01-01&hasta=2025-06-01"));
    expect(largo.status).toBe(400);
    expect(await largo.text()).toBe("El rango no puede superar los 366 días");
    expect(mocks.filasPedidos).not.toHaveBeenCalled();
  });

  it("422 si se supera el tope, sin fichero truncado", async () => {
    mocks.filasPedidos.mockResolvedValue(null);

    const respuesta = await getPedidos(peticion("/admin/exportar/pedidos.csv", "desde=2026-01-01&hasta=2026-12-31"));
    expect(respuesta.status).toBe(422);
    expect(respuesta.headers.get("Content-Type")).toContain("text/plain");
    expect(await respuesta.text()).toContain("Acota el rango de fechas");
  });

  it("CSV con cabeceras de descarga, signo y fórmulas neutralizadas", async () => {
    mocks.filasIngresos.mockResolvedValue([factura]);

    const respuesta = await getIngresos(
      peticion("/admin/exportar/ingresos.csv", "desde=2026-10-01&hasta=2026-10-31&concepto=venta"),
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(respuesta.headers.get("Content-Disposition")).toBe(
      'attachment; filename="ingresos_2026-10-01_2026-10-31.csv"',
    );
    expect(mocks.filasIngresos).toHaveBeenCalledWith(expect.objectContaining({ concepto: "venta" }));

    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const [cabecera, linea] = new TextDecoder().decode(bytes).split("\r\n");
    expect(cabecera).toContain("Total (€, IVA incl.)");
    expect(linea).toBe(
      "RECT-2026-0001;Rectificativa;No;FAC-2026-0001;;Venta;10/10/2026 12:00;'=Cliente raro;c@demo.local;Simplificada;-148,76;-31,24;-180,00",
    );
  });

  it("facturas.csv es la misma exportación que ingresos.csv", async () => {
    mocks.filasIngresos.mockResolvedValue([]);

    const respuesta = await getFacturas(peticion("/admin/exportar/facturas.csv", "desde=2026-01-01&hasta=2026-12-31"));
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Disposition")).toContain("ingresos_2026-01-01_2026-12-31.csv");
  });
});
