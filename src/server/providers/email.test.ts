import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConsoleEmailProvider,
  MailpitEmailProvider,
  obtenerEmailProvider,
  parsearRemitente,
  urlApp,
} from "@/server/providers/email";

const EMAIL = { to: "cliente@demo.local", subject: "Asunto", text: "Texto", html: "<p>HTML</p>" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("obtenerEmailProvider", () => {
  it("sin configurar usa console (no sale nada)", () => {
    expect(obtenerEmailProvider({}).nombre).toBe("console");
    expect(obtenerEmailProvider({ EMAIL_PROVIDER: "" }).nombre).toBe("console");
  });

  it("elige mailpit o resend por variable de entorno", () => {
    expect(obtenerEmailProvider({ EMAIL_PROVIDER: "mailpit" }).nombre).toBe("mailpit");
    expect(obtenerEmailProvider({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test" }).nombre).toBe("resend");
  });

  it("resend sin clave o un proveedor desconocido fallan", () => {
    expect(() => obtenerEmailProvider({ EMAIL_PROVIDER: "resend" })).toThrow("RESEND_API_KEY");
    expect(() => obtenerEmailProvider({ EMAIL_PROVIDER: "smtp" })).toThrow("desconocido");
  });
});

describe("ConsoleEmailProvider", () => {
  it("guarda los emails en memoria", async () => {
    const proveedor = new ConsoleEmailProvider();
    await proveedor.enviar(EMAIL);

    expect(proveedor.enviados).toEqual([EMAIL]);
  });
});

describe("MailpitEmailProvider", () => {
  it("envía por la API HTTP de Mailpit con remitente y destinatario", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ID":"x"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await new MailpitEmailProvider("http://localhost:8025/", "Demo <no-reply@demo.local>").enviar(EMAIL);

    const [url, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8025/api/v1/send");
    expect(JSON.parse(opciones.body as string)).toEqual({
      From: { Email: "no-reply@demo.local", Name: "Demo" },
      To: [{ Email: "cliente@demo.local" }],
      Subject: "Asunto",
      Text: "Texto",
      HTML: "<p>HTML</p>",
    });
  });

  it("un error HTTP se convierte en excepción (el worker lo reintenta)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("caído", { status: 503 })));

    await expect(new MailpitEmailProvider("http://localhost:8025", "a@b.c").enviar(EMAIL)).rejects.toThrow(
      "Mailpit respondió 503: caído",
    );
  });
});

describe("utilidades", () => {
  it("parsearRemitente", () => {
    expect(parsearRemitente("SoftHard <no-reply@x.demo>")).toEqual({ name: "SoftHard", email: "no-reply@x.demo" });
    expect(parsearRemitente("solo@x.demo")).toEqual({ email: "solo@x.demo" });
  });

  it("urlApp con APP_URL o localhost por defecto", () => {
    expect(urlApp("/app/pedidos/1", {})).toBe("http://localhost:3000/app/pedidos/1");
    expect(urlApp("app/x", { APP_URL: "https://demo.test/" })).toBe("https://demo.test/app/x");
  });
});
