import { after } from "next/server";

import { procesarEmailsPendientesSinFallar } from "@/server/data/emails";

/**
 * Tras una acción que encola emails, intenta enviarlos en cuanto termina la
 * respuesta (`after()` de Next), para que en desarrollo lleguen al momento
 * aunque el worker no esté arrancado. Es un atajo, no la garantía: si falla,
 * o si se llama fuera de una petición (tests, scripts), el worker los recoge.
 */
export function programarEnvioEmails(): void {
  try {
    after(procesarEmailsPendientesSinFallar);
  } catch {
    // Fuera de una petición de Next no hay `after()`: lo enviará el worker.
  }
}
