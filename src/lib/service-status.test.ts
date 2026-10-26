import { describe, expect, it } from "vitest";

import {
  TRANSICIONES_NORMALES,
  estadosDisponibles,
  evaluarCambioEstado,
  necesitaPresupuesto,
  opcionesCambioEstado,
  type ContextoTransicion,
} from "@/lib/service-status";

const TRABAJADOR: ContextoTransicion = {
  actual: "aceptada",
  rol: "trabajador",
  asignadaAlTrabajador: true,
  tienePresupuesto: true,
};

const STAFF: ContextoTransicion = {
  actual: "diagnosticada",
  rol: "encargado",
  asignadaAlTrabajador: false,
  tienePresupuesto: true,
};

describe("TRANSICIONES_NORMALES", () => {
  it("define el flujo operativo del trabajador", () => {
    expect(TRANSICIONES_NORMALES.trabajador.aceptada).toEqual([
      "en_reparacion",
    ]);
    expect(TRANSICIONES_NORMALES.trabajador.en_reparacion).toEqual([
      "esperando_repuesto",
      "lista",
    ]);
    expect(TRANSICIONES_NORMALES.trabajador.esperando_repuesto).toEqual([
      "en_reparacion",
    ]);
    expect(TRANSICIONES_NORMALES.trabajador.lista).toEqual([]);
    expect(TRANSICIONES_NORMALES.trabajador.entregada).toEqual([]);
  });

  it("añade la entrega al flujo normal de encargado y admin", () => {
    for (const rol of ["encargado", "admin"] as const) {
      expect(TRANSICIONES_NORMALES[rol].aceptada).toEqual(["en_reparacion"]);
      expect(TRANSICIONES_NORMALES[rol].en_reparacion).toEqual([
        "esperando_repuesto",
        "lista",
      ]);
      expect(TRANSICIONES_NORMALES[rol].esperando_repuesto).toEqual([
        "en_reparacion",
      ]);
      expect(TRANSICIONES_NORMALES[rol].lista).toEqual(["entregada"]);
    }
  });

  it("no permite marcar lista desde esperando repuesto en ningún rol", () => {
    for (const rol of ["trabajador", "encargado", "admin"] as const) {
      expect(TRANSICIONES_NORMALES[rol].esperando_repuesto).not.toContain(
        "lista",
      );
    }
  });
});

describe("evaluarCambioEstado", () => {
  it("permite al trabajador asignado aceptar y empezar la reparación", () => {
    expect(
      evaluarCambioEstado({
        ...TRABAJADOR,
        nuevo: "en_reparacion",
        motivo: null,
      }),
    ).toEqual({ permitida: true, requiereMotivo: false });
  });

  it("permite al trabajador alternar reparación y espera de repuesto", () => {
    expect(
      evaluarCambioEstado({
        ...TRABAJADOR,
        actual: "esperando_repuesto",
        nuevo: "en_reparacion",
      }),
    ).toEqual({ permitida: true, requiereMotivo: false });

    expect(
      evaluarCambioEstado({
        ...TRABAJADOR,
        actual: "en_reparacion",
        nuevo: "esperando_repuesto",
      }),
    ).toEqual({ permitida: true, requiereMotivo: false });
  });

  it("permite al trabajador marcar lista solo desde reparación", () => {
    expect(
      evaluarCambioEstado({
        ...TRABAJADOR,
        actual: "en_reparacion",
        nuevo: "lista",
      }),
    ).toEqual({ permitida: true, requiereMotivo: false });

    expect(
      evaluarCambioEstado({
        ...TRABAJADOR,
        actual: "esperando_repuesto",
        nuevo: "lista",
      }),
    ).toEqual({ permitida: false, motivo: "transicion-invalida" });
  });

  it("impide al trabajador entregar la reparación", () => {
    expect(
      evaluarCambioEstado({
        ...TRABAJADOR,
        actual: "lista",
        nuevo: "entregada",
      }),
    ).toEqual({ permitida: false, motivo: "transicion-invalida" });
  });

  it("impide al trabajador tocar una solicitud no asignada", () => {
    expect(
      evaluarCambioEstado({
        ...TRABAJADOR,
        asignadaAlTrabajador: false,
        nuevo: "en_reparacion",
      }),
    ).toEqual({ permitida: false, motivo: "no-asignada" });
  });

  it("permite al staff las transiciones normales sin motivo", () => {
    expect(
      evaluarCambioEstado({
        ...STAFF,
        actual: "lista",
        nuevo: "entregada",
      }),
    ).toEqual({ permitida: true, requiereMotivo: false });

    expect(
      evaluarCambioEstado({
        ...STAFF,
        actual: "en_reparacion",
        nuevo: "lista",
      }),
    ).toEqual({ permitida: true, requiereMotivo: false });
  });

  it("exige motivo al staff para corregir fuera del flujo normal", () => {
    expect(
      evaluarCambioEstado({
        ...STAFF,
        actual: "entregada",
        nuevo: "pendiente",
        motivo: "  ",
      }),
    ).toEqual({ permitida: false, motivo: "motivo-obligatorio" });

    expect(
      evaluarCambioEstado({
        ...STAFF,
        actual: "entregada",
        nuevo: "pendiente",
        motivo: "Error de entrega",
      }),
    ).toEqual({ permitida: true, requiereMotivo: true });
  });

  it("no permite aceptar ni rechazar sin presupuesto", () => {
    expect(necesitaPresupuesto("aceptada")).toBe(true);
    expect(necesitaPresupuesto("rechazada")).toBe(true);
    expect(
      evaluarCambioEstado({
        ...STAFF,
        actual: "diagnosticada",
        nuevo: "aceptada",
        tienePresupuesto: false,
        motivo: "Corrección",
      }),
    ).toEqual({ permitida: false, motivo: "sin-presupuesto" });
  });

  it("permite al staff aceptar con presupuesto como corrección justificada", () => {
    expect(
      evaluarCambioEstado({
        ...STAFF,
        actual: "diagnosticada",
        nuevo: "aceptada",
        tienePresupuesto: true,
        motivo: "El cliente confirma por teléfono",
      }),
    ).toEqual({ permitida: true, requiereMotivo: true });
  });

  it("rechaza repetir el mismo estado", () => {
    expect(
      evaluarCambioEstado({
        ...STAFF,
        actual: "lista",
        nuevo: "lista",
      }),
    ).toEqual({ permitida: false, motivo: "mismo-estado" });
  });
});

describe("opcionesCambioEstado", () => {
  it("solo ofrece al trabajador su flujo normal", () => {
    const opciones = opcionesCambioEstado(TRABAJADOR);

    expect(opciones).toEqual([
      { estado: "en_reparacion", requiereMotivo: false },
    ]);
    expect(estadosDisponibles(TRABAJADOR)).toEqual(["en_reparacion"]);
  });

  it("no ofrece nada a un trabajador sin asignación", () => {
    expect(
      opcionesCambioEstado({ ...TRABAJADOR, asignadaAlTrabajador: false }),
    ).toEqual([]);
  });

  it("ofrece al staff las correcciones marcadas con motivo obligatorio", () => {
    const opciones = opcionesCambioEstado({
      ...STAFF,
      actual: "aceptada",
    });

    expect(opciones).toHaveLength(8);
    expect(opciones).toContainEqual({
      estado: "en_reparacion",
      requiereMotivo: false,
    });
    expect(opciones).toContainEqual({
      estado: "entregada",
      requiereMotivo: true,
    });
    expect(opciones).toContainEqual({
      estado: "pendiente",
      requiereMotivo: true,
    });
  });

  it("oculta aceptada y rechazada si no hay presupuesto", () => {
    const estados = estadosDisponibles({
      ...STAFF,
      actual: "diagnosticada",
      tienePresupuesto: false,
    });

    expect(estados).not.toContain("aceptada");
    expect(estados).not.toContain("rechazada");
    expect(estados).toContain("en_reparacion");
  });
});
