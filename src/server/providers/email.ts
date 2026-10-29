/**
 * Proveedores de email intercambiables (5.2). El resto del código solo usa la
 * interfaz `EmailProvider` y `obtenerEmailProvider()`: el proveedor concreto se
 * elige aquí, en un único punto, con `EMAIL_PROVIDER`.
 *
 * - `console` (por defecto): no envía nada; guarda los emails en memoria. Es el
 *   de los tests y el del CI, para que nada salga sin configurarlo.
 * - `mailpit`: API HTTP de envío de Mailpit (`POST /api/v1/send`) con `fetch`,
 *   sin dependencia SMTP. En desarrollo todo se ve en http://localhost:8025.
 * - `resend`: API REST de Resend con `fetch`, sin SDK. Preparado, no activo.
 */

export type EmailSaliente = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailProvider {
  readonly nombre: string;
  enviar(email: EmailSaliente): Promise<void>;
}

const REMITENTE_DEFECTO = "SoftHard A&L (demo) <no-reply@softhard-al.demo>";

/** `"Nombre <email>"` o solo `email`. */
export function parsearRemitente(valor: string): { name?: string; email: string } {
  const coincidencia = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(valor);

  return coincidencia
    ? { ...(coincidencia[1] ? { name: coincidencia[1] } : {}), email: coincidencia[2]!.trim() }
    : { email: valor.trim() };
}

/** Registra en memoria: para los tests y para cuando no hay proveedor configurado. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly nombre = "console";
  readonly enviados: EmailSaliente[] = [];

  async enviar(email: EmailSaliente): Promise<void> {
    this.enviados.push(email);
  }
}

async function comprobarRespuesta(respuesta: Response, proveedor: string): Promise<void> {
  if (!respuesta.ok) {
    const detalle = (await respuesta.text().catch(() => "")).slice(0, 300);
    throw new Error(`${proveedor} respondió ${respuesta.status}: ${detalle}`);
  }
}

export class MailpitEmailProvider implements EmailProvider {
  readonly nombre = "mailpit";

  constructor(
    private readonly baseUrl: string,
    private readonly remitente: string,
  ) {}

  async enviar(email: EmailSaliente): Promise<void> {
    const from = parsearRemitente(this.remitente);
    const respuesta = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: from.email, ...(from.name ? { Name: from.name } : {}) },
        To: [{ Email: email.to }],
        Subject: email.subject,
        Text: email.text,
        HTML: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    await comprobarRespuesta(respuesta, "Mailpit");
  }
}

/** Preparado para más adelante; no se activa en esta fase. */
export class ResendEmailProvider implements EmailProvider {
  readonly nombre = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly remitente: string,
  ) {}

  async enviar(email: EmailSaliente): Promise<void> {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.remitente,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    await comprobarRespuesta(respuesta, "Resend");
  }
}

type EntornoEmail = {
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  MAILPIT_URL?: string;
  RESEND_API_KEY?: string;
};

let consolaCompartida: ConsoleEmailProvider | null = null;

export function obtenerEmailProvider(entorno: EntornoEmail = process.env as EntornoEmail): EmailProvider {
  const remitente = entorno.EMAIL_FROM?.trim() || REMITENTE_DEFECTO;

  switch (entorno.EMAIL_PROVIDER?.trim().toLowerCase() || "console") {
    case "mailpit":
      return new MailpitEmailProvider(entorno.MAILPIT_URL?.trim() || "http://localhost:8025", remitente);
    case "resend": {
      const apiKey = entorno.RESEND_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("EMAIL_PROVIDER=resend necesita RESEND_API_KEY.");
      }
      return new ResendEmailProvider(apiKey, remitente);
    }
    case "console":
      consolaCompartida ??= new ConsoleEmailProvider();
      return consolaCompartida;
    default:
      throw new Error(`EMAIL_PROVIDER desconocido: ${entorno.EMAIL_PROVIDER}`);
  }
}

/** URL absoluta de la app para los enlaces de los emails (`APP_URL`). */
export function urlApp(ruta: string, entorno: { APP_URL?: string } = process.env as { APP_URL?: string }): string {
  const base = (entorno.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

  return `${base}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}
