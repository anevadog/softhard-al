/**
 * Pasarela de pago intercambiable (5.3). El resto del código solo usa la
 * interfaz `PaymentProvider` y `obtenerPaymentProvider()`; el proveedor se elige
 * aquí con `PAYMENT_PROVIDER`.
 *
 * - `mock` (por defecto): no cobra nada real. La "pasarela" es la página
 *   `/pago/mock/[sesion]`, que llama a `confirmarPago` como lo haría un webhook.
 * - `stripe`: encajaría con Checkout Session + webhook firmado; no está
 *   implementado en esta fase (spec propia si se hace).
 */

export type NombreProveedorPago = "mock" | "stripe";

export type SesionCreada = {
  /** Identificador de la sesión en el proveedor (único, para la idempotencia). */
  id: string;
  /** Adónde se manda al cliente para pagar. */
  urlPago: string;
};

export interface PaymentProvider {
  readonly nombre: NombreProveedorPago;
  crearSesion(datos: { importeCentimos: number; referencia: string; urlRetorno: string }): Promise<SesionCreada>;
  reembolsar(id: string): Promise<void>;
}

/**
 * Sin estado ni E/S: el identificador se deriva de nuestra referencia (el id de
 * la `PaymentSession`) y la URL de pago es la página mock de la propia app.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly nombre = "mock" as const;
  readonly reembolsos: string[] = [];

  async crearSesion(datos: {
    importeCentimos: number;
    referencia: string;
    urlRetorno: string;
  }): Promise<SesionCreada> {
    if (!Number.isInteger(datos.importeCentimos) || datos.importeCentimos <= 0) {
      throw new Error("Importe de pago no válido");
    }

    return { id: `mock_${datos.referencia}`, urlPago: `/pago/mock/${datos.referencia}` };
  }

  async reembolsar(id: string): Promise<void> {
    this.reembolsos.push(id);
  }
}

let mockCompartido: MockPaymentProvider | null = null;

/** Proveedor configurado; por defecto, el mock. */
export function nombreProveedorPago(
  entorno: { PAYMENT_PROVIDER?: string } = process.env as { PAYMENT_PROVIDER?: string },
): NombreProveedorPago {
  const valor = entorno.PAYMENT_PROVIDER?.trim().toLowerCase() || "mock";

  if (valor !== "mock" && valor !== "stripe") {
    throw new Error(`PAYMENT_PROVIDER desconocido: ${entorno.PAYMENT_PROVIDER}`);
  }

  return valor;
}

export function obtenerPaymentProvider(
  entorno: { PAYMENT_PROVIDER?: string } = process.env as { PAYMENT_PROVIDER?: string },
): PaymentProvider {
  const nombre = nombreProveedorPago(entorno);

  if (nombre === "stripe") {
    throw new Error("La pasarela Stripe no está activada en esta fase (PAYMENT_PROVIDER=stripe).");
  }

  mockCompartido ??= new MockPaymentProvider();

  return mockCompartido;
}

/** La página mock solo existe con el proveedor mock activo (si no, 404). */
export function proveedorMockActivo(
  entorno: { PAYMENT_PROVIDER?: string } = process.env as { PAYMENT_PROVIDER?: string },
): boolean {
  try {
    return nombreProveedorPago(entorno) === "mock";
  } catch {
    return false;
  }
}
