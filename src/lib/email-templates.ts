import type { Modality } from "@/generated/prisma/enums";
import { formatEuros, formatearFechaHora } from "@/lib/format";

/**
 * Plantillas de los emails transaccionales (5.2): texto plano y HTML sencillo,
 * en español, sin imágenes remotas ni tracking y sin datos internos (notas,
 * responsable). Todo dato que viene del cliente se escapa en el HTML.
 */

export type EmailRenderizado = {
  subject: string;
  text: string;
  html: string;
};

const MARCA = "SoftHard A&L";

export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const euros = (centimos: number) => formatEuros(centimos / 100);

/** Envoltorio HTML común. `cuerpo` ya viene escapado. */
function documento(titulo: string, cuerpo: string, enlace: { url: string; texto: string }): string {
  return [
    "<!doctype html>",
    '<html lang="es"><head><meta charset="utf-8">',
    `<title>${escaparHtml(titulo)}</title></head>`,
    '<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">',
    `<p style="margin:0 0 16px;font-size:13px;color:#64748b;">${escaparHtml(MARCA)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:20px;">${escaparHtml(titulo)}</h1>`,
    cuerpo,
    `<p style="margin:24px 0 0;"><a href="${escaparHtml(enlace.url)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;">${escaparHtml(enlace.texto)}</a></p>`,
    `<p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">Email automático de ${escaparHtml(MARCA)} (proyecto de demostración). Importes con IVA incluido.</p>`,
    "</div></body></html>",
  ].join("");
}

const parrafo = (texto: string) => `<p style="margin:0 0 12px;line-height:1.5;">${escaparHtml(texto)}</p>`;

export type DatosPedidoConfirmado = {
  nombre: string;
  pedidoId: string;
  lineas: readonly { producto: string; cantidad: number; precioCentimos: number }[];
  totalCentimos: number;
  expiresAt: Date | null;
  url: string;
};

/** Al crear el pedido (`pendiente`): el pago todavía está pendiente. */
export function emailPedidoConfirmado(datos: DatosPedidoConfirmado): EmailRenderizado {
  const subject = `Hemos recibido tu pedido (${euros(datos.totalCentimos)})`;
  const caducidad = datos.expiresAt
    ? `Si no se paga antes del ${formatearFechaHora(datos.expiresAt)} (hora de Madrid), el pedido caducará y se liberará el stock.`
    : null;
  const lineasTexto = datos.lineas.map(
    (linea) =>
      `- ${linea.cantidad} × ${linea.producto}: ${euros(linea.precioCentimos * linea.cantidad)}`,
  );

  const text = [
    `Hola, ${datos.nombre}:`,
    "",
    "Hemos recibido tu pedido. El pago está pendiente.",
    "",
    ...lineasTexto,
    `Total (IVA incluido): ${euros(datos.totalCentimos)}`,
    "",
    ...(caducidad ? [caducidad, ""] : []),
    `Ver el pedido: ${datos.url}`,
    "",
    `— ${MARCA}`,
  ].join("\n");

  const filas = datos.lineas
    .map(
      (linea) =>
        `<tr><td style="padding:6px 0;">${linea.cantidad} × ${escaparHtml(linea.producto)}</td><td style="padding:6px 0;text-align:right;">${escaparHtml(euros(linea.precioCentimos * linea.cantidad))}</td></tr>`,
    )
    .join("");
  const tabla =
    `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 12px;">${filas}` +
    `<tr><td style="padding:8px 0;border-top:1px solid #e2e8f0;font-weight:bold;">Total (IVA incluido)</td>` +
    `<td style="padding:8px 0;border-top:1px solid #e2e8f0;text-align:right;font-weight:bold;">${escaparHtml(euros(datos.totalCentimos))}</td></tr></table>`;

  const html = documento(
    "Hemos recibido tu pedido",
    [
      parrafo(`Hola, ${datos.nombre}:`),
      parrafo("Hemos recibido tu pedido. El pago está pendiente."),
      tabla,
      caducidad ? parrafo(caducidad) : "",
    ].join(""),
    { url: datos.url, texto: "Ver el pedido" },
  );

  return { subject, text, html };
}

export type DatosPresupuestoListo = {
  nombre: string;
  equipo: string;
  presupuestoCentimos: number;
  diagnosticoCentimos: number;
  /** Lo que paga el cliente si acepta: presupuesto − diagnóstico. */
  finalCentimos: number;
  expiresAt: Date;
  url: string;
};

/** Al crear el presupuesto (la solicitud pasa a `diagnosticada`). */
export function emailPresupuestoListo(datos: DatosPresupuestoListo): EmailRenderizado {
  const subject = `Tu presupuesto está listo: ${datos.equipo}`;
  const importes = [
    `Presupuesto de la reparación: ${euros(datos.presupuestoCentimos)}.`,
    `Si lo aceptas, pagarás ${euros(datos.finalCentimos)}: ya descontamos el diagnóstico (${euros(datos.diagnosticoCentimos)}).`,
  ];
  const plazo = `Puedes aceptarlo o rechazarlo hasta el ${formatearFechaHora(datos.expiresAt)} (hora de Madrid).`;

  const text = [
    `Hola, ${datos.nombre}:`,
    "",
    `Ya hemos diagnosticado tu ${datos.equipo}.`,
    ...importes,
    plazo,
    "",
    `Ver el presupuesto: ${datos.url}`,
    "",
    `— ${MARCA}`,
  ].join("\n");

  const html = documento(
    "Tu presupuesto está listo",
    [
      parrafo(`Hola, ${datos.nombre}:`),
      parrafo(`Ya hemos diagnosticado tu ${datos.equipo}.`),
      ...importes.map(parrafo),
      parrafo(plazo),
    ].join(""),
    { url: datos.url, texto: "Ver el presupuesto" },
  );

  return { subject, text, html };
}

export type DatosReparacionLista = {
  nombre: string;
  equipo: string;
  modalidad: Modality;
  /** Importe pendiente de pago (IVA incluido); nulo o 0 si no hay nada que cobrar. */
  pendienteCentimos: number | null;
  url: string;
};

/** Al pasar la solicitud a `lista`: recogida en taller o entrega a domicilio. */
export function emailReparacionLista(datos: DatosReparacionLista): EmailRenderizado {
  const subject = `Tu ${datos.equipo} está listo`;
  const entrega =
    datos.modalidad === "domicilio"
      ? "Te lo llevaremos a la dirección de recogida que indicaste; nos pondremos en contacto contigo para acordar la entrega."
      : "Ya puedes pasar a recogerlo por el taller en nuestro horario de atención.";
  const pago =
    datos.pendienteCentimos && datos.pendienteCentimos > 0
      ? `Importe pendiente (IVA incluido): ${euros(datos.pendienteCentimos)}.`
      : null;

  const text = [
    `Hola, ${datos.nombre}:`,
    "",
    `Hemos terminado la reparación de tu ${datos.equipo}.`,
    entrega,
    ...(pago ? [pago] : []),
    "",
    `Ver la solicitud: ${datos.url}`,
    "",
    `— ${MARCA}`,
  ].join("\n");

  const html = documento(
    "Tu reparación está lista",
    [
      parrafo(`Hola, ${datos.nombre}:`),
      parrafo(`Hemos terminado la reparación de tu ${datos.equipo}.`),
      parrafo(entrega),
      pago ? parrafo(pago) : "",
    ].join(""),
    { url: datos.url, texto: "Ver la solicitud" },
  );

  return { subject, text, html };
}
