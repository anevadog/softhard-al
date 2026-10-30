import { describe, expect, it } from "vitest";

import { EMISOR, codigoFactura, desglosarFactura } from "@/lib/invoices";
import { aCentimos } from "@/lib/vat";
import {
  conSavepoint,
  crearPresupuesto,
  crearProducto,
  crearSolicitud,
  crearUsuario,
  enTransaccion,
  type Tx,
} from "@/test/integration/db";

/**
 * Facturas retroactivas (serie MIG): la función SQL de la migración
 * `20261029101854_facturas_retroactivas` debe dar las mismas líneas y el mismo
 * desglose que la app (`contenidoFacturaEnTx` + `lib/vat.ts`).
 */

type Entidad = { tipo: "pedido"; id: string } | { tipo: "solicitud"; id: string };

async function emitirRetroactivas(tx: Tx): Promise<number> {
  const [fila] = await tx.$queryRaw<{ creadas: number }[]>`
    SELECT "emitir_facturas_retroactivas"() AS "creadas"`;

  return fila.creadas;
}

/** Pedido cobrado antes de la facturación: con cobro y sin ninguna factura. */
async function pedidoCobradoSinFactura(
  tx: Tx,
  datos: {
    lineas: { price: string; quantity: number; name: string }[];
    paidAt: Date;
    paidAmount?: string;
    nif?: string;
  },
) {
  const cliente = await crearUsuario(tx, "cliente", "Cliente MIG");
  if (datos.nif) {
    await tx.user.update({ where: { id: cliente.id }, data: { nif: datos.nif } });
  }

  const productos: { id: string }[] = [];
  for (const linea of datos.lineas) {
    productos.push(await crearProducto(tx, { stock: 10, price: linea.price, name: linea.name }));
  }

  const totalCentimos = datos.lineas.reduce(
    (suma, linea) => suma + aCentimos(Number(linea.price)) * linea.quantity,
    0,
  );
  const total = (totalCentimos / 100).toFixed(2);

  const pedido = await tx.order.create({
    data: {
      userId: cliente.id,
      total,
      status: "entregado",
      paidAt: datos.paidAt,
      paidAmount: datos.paidAmount ?? total,
      items: {
        create: datos.lineas.map((linea, i) => ({
          productId: productos[i].id,
          quantity: linea.quantity,
          price: linea.price,
        })),
      },
    },
  });

  return { pedido, cliente };
}

/** Solicitud cobrada antes de la facturación, con su presupuesto. */
async function solicitudCobradaSinFactura(
  tx: Tx,
  datos: {
    presupuesto: "aceptado" | "rechazado" | "expirado";
    paidAt: Date;
    paidAmount: string;
    budgetAmount?: string;
    nif?: string;
    domicilio?: boolean;
  },
) {
  const cliente = await crearUsuario(tx, "cliente", "Cliente MIG taller");
  if (datos.nif) {
    await tx.user.update({ where: { id: cliente.id }, data: { nif: datos.nif } });
  }

  const status =
    datos.presupuesto === "aceptado"
      ? "entregada"
      : datos.presupuesto === "rechazado"
        ? "rechazada"
        : "expirada";
  const solicitud = await crearSolicitud(tx, {
    clientId: cliente.id,
    status,
    equipmentType: "portatil",
    modality: datos.domicilio ? "domicilio" : "taller",
    address: datos.domicilio ? "Calle Falsa 123, Madrid" : null,
  });
  await crearPresupuesto(tx, {
    requestId: solicitud.id,
    status: datos.presupuesto,
    budgetAmount: datos.budgetAmount,
  });
  await tx.serviceRequest.update({
    where: { id: solicitud.id },
    data: { paidAt: datos.paidAt, paidAmount: datos.paidAmount, paymentMethod: "efectivo" },
  });

  return { solicitud, cliente };
}

async function facturaDe(tx: Tx, entidad: Entidad) {
  return tx.invoice.findFirstOrThrow({
    where: entidad.tipo === "pedido" ? { orderId: entidad.id } : { requestId: entidad.id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
}

/** Compara la factura MIG con lo que emitiría la app para la misma entidad. */
async function expectIgualQueLaApp(tx: Tx, entidad: Entidad) {
  const { contenidoFacturaEnTx } = await import("@/server/data/invoices");
  const contenido = await contenidoFacturaEnTx(tx, entidad);
  if (!contenido) throw new Error("la entidad no es facturable");

  const { lineas, totales } = desglosarFactura(contenido.lineas, 21);
  const factura = await facturaDe(tx, entidad);

  expect(factura.concept).toBe(contenido.concept);
  expect(
    factura.lines.map((linea) => ({
      description: linea.description,
      quantity: linea.quantity,
      unitPriceCentimos: aCentimos(Number(linea.unitPrice)),
      totalCentimos: aCentimos(Number(linea.lineTotal)),
      baseCentimos: aCentimos(Number(linea.lineBase)),
      ivaCentimos: aCentimos(Number(linea.lineVat)),
    })),
  ).toEqual(lineas);
  expect({
    totalCentimos: aCentimos(Number(factura.total)),
    baseCentimos: aCentimos(Number(factura.baseTotal)),
    ivaCentimos: aCentimos(Number(factura.vatTotal)),
  }).toEqual(totales);

  return factura;
}

describe("facturas retroactivas MIG", () => {
  it("un pedido cobrado recibe una MIG igual que la app: líneas, desglose y emisor", () =>
    enTransaccion(async (tx) => {
      const paidAt = new Date("2026-03-10T10:00:00Z");
      const { pedido, cliente } = await pedidoCobradoSinFactura(tx, {
        paidAt,
        lineas: [
          { name: "Ratón MIG", price: "19.99", quantity: 3 },
          { name: "Cable MIG", price: "0.01", quantity: 1 },
          { name: "Tóner MIG", price: "44.95", quantity: 2 },
        ],
      });

      expect(await emitirRetroactivas(tx)).toBe(1);

      const factura = await expectIgualQueLaApp(tx, { tipo: "pedido", id: pedido.id });
      expect(factura).toMatchObject({
        id: `mig-${pedido.id}`,
        series: "MIG",
        kind: "ordinaria",
        isBackfill: true,
        issuedAt: paidAt,
        mode: "simplificada",
        customerId: cliente.id,
        customerName: "Cliente MIG",
        customerTaxId: null,
        customerAddress: null,
        issuedById: null,
        orderId: pedido.id,
        requestId: null,
        issuerName: EMISOR.name,
        issuerTaxId: EMISOR.taxId,
        issuerAddress: EMISOR.address,
        issuerEmail: EMISOR.email,
      });
      expect(factura.total.toString()).toBe(pedido.paidAmount?.toString());
      expect(factura.vatRate.toString()).toBe("21");
      expect(factura.lines.map((linea) => linea.id)).toEqual(
        [1, 2, 3].map((posicion) => `mig-${pedido.id}-${posicion}`),
      );
    }));

  it("cobrado distinto del total: añade el ajuste y la factura suma lo cobrado", () =>
    enTransaccion(async (tx) => {
      const { pedido } = await pedidoCobradoSinFactura(tx, {
        paidAt: new Date("2026-04-02T09:00:00Z"),
        paidAmount: "55.00",
        lineas: [{ name: "Teclado MIG", price: "29.95", quantity: 2 }],
      });

      await emitirRetroactivas(tx);

      const factura = await expectIgualQueLaApp(tx, { tipo: "pedido", id: pedido.id });
      expect(factura.lines.at(-1)).toMatchObject({ description: "Ajuste de importe", position: 2 });
      expect(factura.lines.at(-1)?.unitPrice.toString()).toBe("-4.9");
      expect(factura.total.toString()).toBe("55");
    }));

  it("reparación aceptada: reparación menos descuento diagnóstico", () =>
    enTransaccion(async (tx) => {
      const { solicitud } = await solicitudCobradaSinFactura(tx, {
        presupuesto: "aceptado",
        budgetAmount: "120.00",
        paidAt: new Date("2026-05-20T16:00:00Z"),
        paidAmount: "90.00",
      });

      await emitirRetroactivas(tx);

      const factura = await expectIgualQueLaApp(tx, { tipo: "solicitud", id: solicitud.id });
      expect(factura.concept).toBe("reparacion");
      expect(factura.lines.map((linea) => linea.description)).toEqual([
        "Reparación de portátil Test entregada",
        "Descuento diagnóstico",
      ]);
      expect(factura.total.toString()).toBe("90");
    }));

  it("diagnóstico de una rechazada y de una expirada", () =>
    enTransaccion(async (tx) => {
      const rechazada = await solicitudCobradaSinFactura(tx, {
        presupuesto: "rechazado",
        paidAt: new Date("2026-06-01T08:00:00Z"),
        paidAmount: "30.00",
      });
      const expirada = await solicitudCobradaSinFactura(tx, {
        presupuesto: "expirado",
        paidAt: new Date("2026-06-02T08:00:00Z"),
        paidAmount: "30.00",
      });

      expect(await emitirRetroactivas(tx)).toBe(2);

      for (const { solicitud } of [rechazada, expirada]) {
        const factura = await expectIgualQueLaApp(tx, { tipo: "solicitud", id: solicitud.id });
        expect(factura.concept).toBe("diagnostico");
        expect(factura.lines.map((linea) => linea.description)).toEqual(["Diagnóstico"]);
      }
    }));

  it("con NIF la factura es completa, con el NIF y la dirección de la solicitud", () =>
    enTransaccion(async (tx) => {
      const { solicitud } = await solicitudCobradaSinFactura(tx, {
        presupuesto: "aceptado",
        paidAt: new Date("2026-07-07T12:00:00Z"),
        paidAmount: "90.00",
        nif: "12345678Z",
        domicilio: true,
      });

      await emitirRetroactivas(tx);

      const factura = await facturaDe(tx, { tipo: "solicitud", id: solicitud.id });
      expect(factura).toMatchObject({
        mode: "completa",
        customerTaxId: "12345678Z",
        customerAddress: "Calle Falsa 123, Madrid",
      });
    }));

  it("numera por año natural en Europe/Madrid, en orden de paidAt y tras el contador", () =>
    enTransaccion(async (tx) => {
      const contador = await tx.invoiceCounter.findUnique({
        where: { series_year: { series: "MIG", year: 2025 } },
      });
      const previo = contador?.lastNumber ?? 0;

      const linea = [{ name: "Pendrive MIG", price: "9.90", quantity: 1 }];
      // 31/12/2025 23:30 en Madrid (22:30 UTC) → 2025.
      const nochevieja = await pedidoCobradoSinFactura(tx, {
        paidAt: new Date("2025-12-31T22:30:00Z"),
        lineas: linea,
      });
      // 01/01/2026 00:30 en Madrid (23:30 UTC del día 31) → 2026.
      const anoNuevo = await pedidoCobradoSinFactura(tx, {
        paidAt: new Date("2025-12-31T23:30:00Z"),
        lineas: linea,
      });
      // Anterior en el tiempo, creado después: debe numerarse primero.
      const otono = await pedidoCobradoSinFactura(tx, {
        paidAt: new Date("2025-10-15T10:00:00Z"),
        lineas: linea,
      });

      await emitirRetroactivas(tx);

      const [fNochevieja, fAnoNuevo, fOtono] = await Promise.all(
        [nochevieja, anoNuevo, otono].map(({ pedido }) =>
          facturaDe(tx, { tipo: "pedido", id: pedido.id }),
        ),
      );

      expect(fOtono).toMatchObject({ year: 2025, number: previo + 1 });
      expect(fNochevieja).toMatchObject({ year: 2025, number: previo + 2 });
      expect(fNochevieja.code).toBe(codigoFactura("MIG", 2025, previo + 2));
      expect(fAnoNuevo.year).toBe(2026);

      const contador2025 = await tx.invoiceCounter.findUniqueOrThrow({
        where: { series_year: { series: "MIG", year: 2025 } },
      });
      expect(contador2025.lastNumber).toBe(previo + 2);
    }));

  it("no vuelve a facturar: ni lo ya facturado por la app ni una segunda llamada", () =>
    enTransaccion(async (tx) => {
      const cobros = await import("@/server/data/payments");
      const cliente = await crearUsuario(tx, "cliente");
      const encargado = await crearUsuario(tx, "encargado");
      const producto = await crearProducto(tx, { stock: 5, price: "10.00" });
      const pedidos = await import("@/server/data/orders");
      const checkout = await pedidos.crearPedidoCliente(
        cliente.id,
        [{ productId: producto.id, quantity: 1 }],
        `k-mig-${producto.id}`,
      );
      if (!checkout.ok) throw new Error("checkout fallido");
      const cobro = await cobros.registrarCobroPedido({
        id: checkout.pedidoId,
        importe: 10,
        metodo: "efectivo",
        nota: null,
        staff: { id: encargado.id, role: "encargado" },
      });
      if (!cobro.ok) throw new Error(`cobro fallido: ${cobro.motivo}`);

      const { pedido } = await pedidoCobradoSinFactura(tx, {
        paidAt: new Date("2026-02-02T10:00:00Z"),
        lineas: [{ name: "Funda MIG", price: "15.00", quantity: 1 }],
      });

      expect(await emitirRetroactivas(tx)).toBe(1);
      expect(await emitirRetroactivas(tx)).toBe(0);

      const deLaApp = await tx.invoice.findMany({ where: { orderId: checkout.pedidoId } });
      expect(deLaApp.map((factura) => factura.series)).toEqual(["FAC"]);
      expect(await tx.invoice.count({ where: { orderId: pedido.id } })).toBe(1);

      // Retroactiva si y solo si es de la serie MIG.
      const incoherentes = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS "n" FROM "invoices" WHERE "isBackfill" <> ("series" = 'MIG')`;
      expect(Number(incoherentes[0].n)).toBe(0);
    }));

  it("tras emitirlas, todo paidAt no nulo tiene factura", () =>
    enTransaccion(async (tx) => {
      await pedidoCobradoSinFactura(tx, {
        paidAt: new Date("2026-08-08T08:00:00Z"),
        lineas: [{ name: "Hub MIG", price: "24.00", quantity: 1 }],
      });
      await solicitudCobradaSinFactura(tx, {
        presupuesto: "aceptado",
        paidAt: new Date("2026-08-09T08:00:00Z"),
        paidAmount: "90.00",
      });

      await emitirRetroactivas(tx);

      const [sinFactura] = await tx.$queryRaw<{ pedidos: bigint; solicitudes: bigint }[]>`
        SELECT
          (SELECT COUNT(*) FROM "orders" o WHERE o."paidAt" IS NOT NULL
             AND o."id" NOT IN (SELECT "orderId" FROM "invoices" WHERE "orderId" IS NOT NULL)) AS "pedidos",
          (SELECT COUNT(*) FROM "service_requests" sr WHERE sr."paidAt" IS NOT NULL
             AND sr."id" NOT IN (SELECT "requestId" FROM "invoices" WHERE "requestId" IS NOT NULL)) AS "solicitudes"`;
      expect(Number(sinFactura.pedidos)).toBe(0);
      expect(Number(sinFactura.solicitudes)).toBe(0);
    }));

  it("si un cobro no se puede facturar, aborta sin dejar ninguna factura", () =>
    enTransaccion(async (tx) => {
      const { pedido } = await pedidoCobradoSinFactura(tx, {
        paidAt: new Date("2026-09-09T09:00:00Z"),
        lineas: [{ name: "Webcam MIG", price: "35.00", quantity: 1 }],
      });
      // Solicitud cobrada sin presupuesto: la función no sabe facturarla.
      const cliente = await crearUsuario(tx, "cliente");
      const solicitud = await crearSolicitud(tx, { clientId: cliente.id, status: "entregada" });
      await tx.serviceRequest.update({
        where: { id: solicitud.id },
        data: { paidAt: new Date(), paidAmount: "50.00" },
      });

      await conSavepoint(tx, async () => {
        await expect(emitirRetroactivas(tx)).rejects.toThrow(/Quedan cobros sin factura/);
      });

      expect(await tx.invoice.count({ where: { orderId: pedido.id } })).toBe(0);
    }));
});
