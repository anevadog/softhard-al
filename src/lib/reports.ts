import { minutosFichaje, type IntervaloFichaje } from "@/lib/work-logs";

/**
 * Agregaciones puras de los reportes del encargado. Un fichaje cuenta entero en
 * la semana en la que empieza (igual que en la vista del trabajador) y uno
 * abierto cuenta hasta `ahora`.
 */

type Persona = { id: string; name: string };

export type FilaTrabajador = Persona & {
  minutos: number;
  fichajes: number;
};

/**
 * Horas por trabajador. Incluye con 0 a los trabajadores sin fichajes y a
 * quien aparezca en los fichajes aunque ya no tenga rol trabajador. Orden:
 * más minutos primero; empate por nombre.
 */
export function minutosPorTrabajador<T extends IntervaloFichaje & { user: Persona }>(
  fichajes: readonly T[],
  trabajadores: readonly Persona[],
  ahora: Date,
): FilaTrabajador[] {
  const filas = new Map<string, FilaTrabajador>();

  for (const trabajador of trabajadores) {
    filas.set(trabajador.id, { ...trabajador, minutos: 0, fichajes: 0 });
  }

  for (const fichaje of fichajes) {
    const fila = filas.get(fichaje.user.id) ?? { ...fichaje.user, minutos: 0, fichajes: 0 };

    fila.minutos += minutosFichaje(fichaje, ahora);
    fila.fichajes += 1;
    filas.set(fichaje.user.id, fila);
  }

  return [...filas.values()].sort(
    (a, b) => b.minutos - a.minutos || a.name.localeCompare(b.name, "es"),
  );
}

export type FilaReparacion<R> = {
  /** `null` agrupa las horas generales. */
  request: R | null;
  minutosSemana: number;
  /** Total histórico de la reparación; `null` en horas generales. */
  minutosAcumulados: number | null;
};

/**
 * Horas por reparación en la semana, con el acumulado histórico de cada una.
 * `historicos` son todos los fichajes de las reparaciones que aparecen en la
 * semana. Orden: más minutos en la semana primero.
 */
export function minutosPorReparacion<
  T extends IntervaloFichaje & { request: { id: string } | null },
>(
  semana: readonly T[],
  historicos: readonly T[],
  ahora: Date,
): FilaReparacion<NonNullable<T["request"]>>[] {
  type R = NonNullable<T["request"]>;
  const filas = new Map<string | null, FilaReparacion<R>>();

  for (const fichaje of semana) {
    const clave = fichaje.request?.id ?? null;
    const fila = filas.get(clave) ?? {
      request: fichaje.request as R | null,
      minutosSemana: 0,
      minutosAcumulados: clave === null ? null : 0,
    };

    fila.minutosSemana += minutosFichaje(fichaje, ahora);
    filas.set(clave, fila);
  }

  for (const fichaje of historicos) {
    const fila = fichaje.request ? filas.get(fichaje.request.id) : undefined;

    if (fila && fila.minutosAcumulados !== null) {
      fila.minutosAcumulados += minutosFichaje(fichaje, ahora);
    }
  }

  return [...filas.values()].sort((a, b) => b.minutosSemana - a.minutosSemana);
}
