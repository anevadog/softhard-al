import { describe, expect, it } from "vitest";

import {
  emailPedidoConfirmado,
  emailPresupuestoListo,
  emailReparacionLista,
  escaparHtml,
} from "@/lib/email-templates";

const MALICIOSO = `<script>alert("x")</script> & 'hola'`;

describe("escaparHtml", () => {
  it("escapa los caracteres especiales de HTML", () => {
    expect(escaparHtml(MALICIOSO)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;hola&#39;",
    );
  });
});

describe("emailPedidoConfirmado", () => {
  const email = emailPedidoConfirmado({
    nombre: MALICIOSO,
    pedidoId: "ord-1",
    lineas: [
      { producto: "Tóner <b>HP</b>", cantidad: 2, precioCentimos: 7_990 },
      { producto: "Teclado", cantidad: 1, precioCentimos: 4_990 },
    ],
    totalCentimos: 20_970,
    expiresAt: new Date("2026-10-31T10:00:00Z"),
    url: "http://localhost:3000/app/pedidos/ord-1",
  });

  it("asunto con el total y texto con líneas, pago pendiente, caducidad y enlace", () => {
    expect(email.subject).toContain("209,70");
    expect(email.text).toContain("El pago está pendiente");
    expect(email.text).toContain("2 × Tóner <b>HP</b>: 159,80");
    expect(email.text).toContain("Total (IVA incluido): 209,70");
    expect(email.text).toContain("31 oct 2026, 11:00");
    expect(email.text).toContain("http://localhost:3000/app/pedidos/ord-1");
  });

  it("escapa en el HTML los datos del cliente y de los productos", () => {
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>HP</b>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Tóner &lt;b&gt;HP&lt;/b&gt;");
  });

  it("sin imágenes remotas ni píxeles de seguimiento", () => {
    expect(email.html).not.toMatch(/<img/i);
  });
});

describe("emailPresupuestoListo", () => {
  it("importe con IVA, descuento del diagnóstico, plazo y enlace", () => {
    const email = emailPresupuestoListo({
      nombre: "Lucía",
      equipo: "portátil Lenovo IdeaPad 5",
      presupuestoCentimos: 12_000,
      diagnosticoCentimos: 3_000,
      finalCentimos: 9_000,
      expiresAt: new Date("2026-11-05T09:00:00Z"),
      url: "http://localhost:3000/app/solicitudes/req-1",
    });

    expect(email.subject).toBe("Tu presupuesto está listo: portátil Lenovo IdeaPad 5");
    expect(email.text).toContain("Presupuesto de la reparación: 120,00");
    expect(email.text).toContain("pagarás 90,00");
    expect(email.text).toContain("diagnóstico (30,00");
    expect(email.text).toContain("5 nov 2026, 10:00");
    expect(email.html).toContain('href="http://localhost:3000/app/solicitudes/req-1"');
  });
});

describe("emailReparacionLista", () => {
  const base = {
    nombre: "Pablo",
    equipo: "impresora Brother HL-L2350DW",
    pendienteCentimos: 9_000,
    url: "http://localhost:3000/app/solicitudes/req-2",
  };

  it("recogida en taller o entrega a domicilio según la modalidad", () => {
    expect(emailReparacionLista({ ...base, modalidad: "taller" }).text).toContain("recogerlo por el taller");
    expect(emailReparacionLista({ ...base, modalidad: "domicilio" }).text).toContain("Te lo llevaremos");
  });

  it("muestra el importe pendiente solo si hay algo que cobrar", () => {
    expect(emailReparacionLista({ ...base, modalidad: "taller" }).text).toContain("Importe pendiente");
    expect(
      emailReparacionLista({ ...base, modalidad: "taller", pendienteCentimos: 0 }).text,
    ).not.toContain("Importe pendiente");
  });
});
