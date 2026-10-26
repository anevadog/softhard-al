import { describe, expect, it } from "vitest";

import {
  EQUIPMENT_LABELS,
  MODALITY_LABELS,
  SERVICE_STATUSES,
  SERVICE_STATUSES_PANEL,
  SERVICE_STATUS_META,
  TIME_SLOT_LABELS,
  etiquetaEstado,
} from "@/lib/service-requests";

const ESTADOS = [
  "pendiente",
  "diagnosticada",
  "aceptada",
  "rechazada",
  "expirada",
  "en_reparacion",
  "esperando_repuesto",
  "lista",
  "entregada",
] as const;

describe("estados de solicitud", () => {
  it("define etiqueta y estilos para los 9 estados del esquema", () => {
    expect(Object.keys(SERVICE_STATUS_META)).toHaveLength(9);
    expect(SERVICE_STATUSES).toHaveLength(9);

    for (const estado of ESTADOS) {
      expect(SERVICE_STATUS_META[estado].label.length).toBeGreaterThan(0);
      expect(SERVICE_STATUS_META[estado].badgeClass).toMatch(/ring-/);
    }
  });

  it("mantiene el panel limitado a los 8 estados anteriores hasta 3.2", () => {
    expect(SERVICE_STATUSES_PANEL).toHaveLength(8);
    expect(SERVICE_STATUSES_PANEL).not.toContain("esperando_repuesto");
  });

  it("traduce los estados con guion bajo a texto legible", () => {
    expect(etiquetaEstado("en_reparacion")).toBe("En reparación");
    expect(etiquetaEstado("esperando_repuesto")).toBe("Esperando repuesto");
    expect(etiquetaEstado("lista")).toBe("Lista para entregar");
  });
});

describe("etiquetas de dominio", () => {
  it("cubre todos los tipos de equipo del esquema", () => {
    expect(Object.keys(EQUIPMENT_LABELS).sort()).toEqual([
      "impresora",
      "ordenador",
      "otro",
      "portatil",
    ]);
  });

  it("traduce modalidad y franja horaria", () => {
    expect(MODALITY_LABELS.domicilio).toBe("Recogida a domicilio");
    expect(MODALITY_LABELS.taller).toBe("Entrega en taller");
    expect(TIME_SLOT_LABELS.manana).toBe("Mañana");
    expect(TIME_SLOT_LABELS.indiferente).toBe("Indiferente");
  });
});
