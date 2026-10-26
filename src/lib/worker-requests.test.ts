import { describe, expect, it } from "vitest";

import type { ServiceStatus } from "@/generated/prisma/enums";
import { SERVICE_STATUSES } from "@/lib/service-requests";
import {
  accionesEstadoTrabajador,
  agruparPorEstado,
} from "@/lib/worker-requests";

function reparacion(id: string, status: ServiceStatus) {
  return { id, status };
}

describe("agruparPorEstado", () => {
  it("ordena primero los estados que exigen acción y deja lista al final", () => {
    const grupos = agruparPorEstado([
      reparacion("a", "lista"),
      reparacion("b", "esperando_repuesto"),
      reparacion("c", "aceptada"),
      reparacion("d", "en_reparacion"),
    ]);

    expect(grupos.map((grupo) => grupo.estado)).toEqual([
      "aceptada",
      "en_reparacion",
      "esperando_repuesto",
      "lista",
    ]);
    expect(grupos.map((grupo) => grupo.requiereAccion)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("conserva el orden recibido dentro de cada grupo", () => {
    const grupos = agruparPorEstado([
      reparacion("antigua", "en_reparacion"),
      reparacion("otra", "aceptada"),
      reparacion("reciente", "en_reparacion"),
    ]);

    expect(grupos[1]?.reparaciones.map((item) => item.id)).toEqual([
      "antigua",
      "reciente",
    ]);
  });

  it("omite grupos vacíos y estados que no se listan", () => {
    const grupos = agruparPorEstado([
      reparacion("a", "entregada"),
      reparacion("b", "pendiente"),
      reparacion("c", "en_reparacion"),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.estado).toBe("en_reparacion");
  });

  it("devuelve una lista vacía si no hay reparaciones", () => {
    expect(agruparPorEstado([])).toEqual([]);
  });
});

describe("accionesEstadoTrabajador", () => {
  it("permite iniciar una reparación aceptada", () => {
    expect(accionesEstadoTrabajador("aceptada")).toEqual([
      { estado: "en_reparacion", etiqueta: "Iniciar reparación" },
    ]);
  });

  it("permite esperar repuesto o marcar lista desde en reparación", () => {
    expect(accionesEstadoTrabajador("en_reparacion")).toEqual([
      { estado: "esperando_repuesto", etiqueta: "Esperando repuesto" },
      { estado: "lista", etiqueta: "Marcar lista" },
    ]);
  });

  it("desde esperando repuesto solo permite volver a reparación", () => {
    expect(accionesEstadoTrabajador("esperando_repuesto")).toEqual([
      { estado: "en_reparacion", etiqueta: "Volver a reparación" },
    ]);
  });

  it("nunca ofrece entregada ni correcciones en ningún estado", () => {
    for (const estado of SERVICE_STATUSES) {
      const destinos = accionesEstadoTrabajador(estado).map(
        (accion) => accion.estado,
      );

      expect(destinos).not.toContain("entregada");
      expect(destinos.length).toBeLessThanOrEqual(2);
    }

    expect(accionesEstadoTrabajador("lista")).toEqual([]);
    expect(accionesEstadoTrabajador("pendiente")).toEqual([]);
    expect(accionesEstadoTrabajador("rechazada")).toEqual([]);
  });
});
