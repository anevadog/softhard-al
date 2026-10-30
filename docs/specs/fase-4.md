# Spec Fase 4 — Cobros, datos y contabilidad

**Estado:** implementada. Hechas 4.0 (`67cb0a3`), 4.3a (`ed926e8`) y 4.3b: las
retroactivas `MIG` (`eea6ded`, migración `20261029101854_facturas_retroactivas`,
aparte de la de 4.3a porque esa ya estaba aplicada) y el seed histórico
(`a174bc8`, `src/server/seed/`), 4.1 (`ea4cf3e`, `/admin/dashboard`) y 4.2 (`c12137a`, `/admin/exportar/*.csv`). Requiere la deuda previa
(`deuda-fase4.md`), ya cerrada.

## Objetivo
Registrar cada cobro (pedido o reparación) con fecha, importe, método y quién lo
hizo. Que cada cobro tenga su factura simulada, numerada, inmutable y con el IVA
desglosado. Que el encargado y el admin vean los ingresos devengados (ventas
frente a reparaciones) a partir de las facturas y puedan sacar los datos a CSV.

## Dos conceptos distintos
- **Cobro** (`paidAt`, `paidAmount`, `paymentMethod`, `paidById`,
  `paymentNote`): flujo de caja, conciliación bancaria y auditoría. Se registra
  una vez y no se vacía nunca, ni siquiera al rectificar.
- **Ingreso**: `Invoice.total` agrupado por `Invoice.issuedAt`. Las originales
  suman y las rectificativas (total negativo) restan en el mes de su emisión. Es
  la única fuente de verdad del dashboard de ingresos.

## Orden de ejecución
4.0 → 4.3 → 4.1 → 4.2. El dashboard (4.1) y el CSV de ingresos (4.2) se calculan
sobre las facturas, así que la facturación (4.3) va antes que ellos. Se mantiene
la numeración original de las sub-fases.

## Actores y permisos
- `admin` y `encargado` (staff): registran cobros, emiten rectificativas, ven el
  dashboard y exportan. Solo `admin` puede cambiar el importe de un cobro. Se
  protege con el middleware de `/admin` y con `requerirStaff()` (o la
  comprobación de admin) en cada acción y en cada route handler.
- `cliente`: ve si su pedido o reparación está pagado, y ve e imprime solo sus
  propias facturas. Ajena → 404.
- `trabajador`: sin acceso a nada de esta fase.

## Regla común: importes con IVA incluido (B2C)
- Venta a particulares. Todos los importes de la BD son **PVP con IVA incluido**:
  `Product.price`, `OrderItem.price`, `Order.total`, `Quote.budgetAmount`,
  `diagnosticFee`, `finalAmount` y `paidAmount`. No se cambia ningún precio
  existente ni el seed.
- La tienda, el carrito, el checkout, el pedido y el presupuesto del cliente
  siguen mostrando el PVP tal cual, sin desglose. **El desglose de IVA solo
  aparece en la factura.**
- Parámetro nuevo en `Config`: `vatRate` (por defecto 21,00). Se lee al emitir
  cada factura y se copia en ella, así que un cambio de tipo no altera las
  facturas emitidas.
- Una sola función pura (`lib/vat.ts`) desglosa en céntimos enteros, línea a
  línea:
  - total de la línea = PVP unitario × cantidad
  - base = redondeo half-up de (total / (1 + tipo))
  - IVA = total − base
  Los totales de la factura son la suma de las líneas. Así el total facturado
  coincide al céntimo con lo cobrado, y base + IVA = total en cada línea y en la
  factura.
- Las líneas negativas (descuentos, ajustes a la baja, rectificativas) se
  desglosan con la misma función: base e IVA salen negativos.

## 4.0 Registro de cobros (pago manual unificado)

### Datos
- Mismos campos en `Order` y en `ServiceRequest`. `Order.paidAt` ya existe por
  la deuda previa; aquí se añaden los demás:
  - `paidAt DateTime?`
  - `paidAmount Decimal(10,2)?`: importe realmente cobrado, IVA incluido.
    Siempre se rellena al registrar un cobro (por defecto, el importe esperado).
  - `paymentMethod String?`: `efectivo`, `bizum`, `transferencia` o
    `tarjeta_online`. Se valida con Zod y con un check en SQL (manual en la
    migración).
  - `paidById String?`: FK a `User`. Nulo = sistema o pasarela; con valor = el
    staff que lo registró.
  - `paymentNote String?`
- Un cobro está registrado cuando `paidAt` no es nulo. Se registra una sola vez,
  con un `updateMany` condicional sobre `paidAt: null`, y **nunca se edita ni se
  vacía**, tampoco al emitir una rectificativa.
- Checks en SQL: `paidAt` y `paidAmount` son nulos o no nulos a la vez, y
  `paidAmount > 0` cuando no es nulo. Un cobro de 0 € no existe.
- Índice sobre `paidAt` en ambas tablas (pendientes de cobro, conciliación).
- Backfill en el SQL de la migración:
  - pedidos con `paid_at` (de la deuda previa) → `paid_amount = total`;
  - solicitudes `entregada` con `finalAmount > 0` → `paidAt` = fecha de su
    última transición a `entregada` (historial), `paidAmount = finalAmount`,
    método y autor nulos, y la nota "Cobro anterior al registro de pagos". Las
    entregadas con `finalAmount = 0` se quedan sin cobro.
  - Las `rechazada` antiguas no se rellenan, porque no consta que se cobrara el
    diagnóstico.

### Importe esperado
- Pedido: `Order.total`. Donde las decisiones dicen `finalAmount` refiriéndose a
  un pedido, se entiende su total.
- Reparación con presupuesto aceptado: `Quote.finalAmount` (presupuesto − X).
- Diagnóstico (solicitud `rechazada` o `expirada`): `Quote.diagnosticFee`. En la
  `rechazada` coincide con `finalAmount`; en la `expirada`, `finalAmount` es nulo.

### Cuándo se puede registrar
- Pedido `pendiente` y no caducado: al registrar el cobro pasa a `pagado` en la
  misma transacción condicional. Sustituye al botón actual "Marcar pagado".
- Reparación en `lista` (presupuesto aceptado): cobro de la reparación.
- Solicitud `rechazada` o `expirada`: cobro del diagnóstico. No cambia el estado
  (son finales) y nunca es obligatorio.
- En cualquier otro estado, si ya hay `paidAt` o si el importe esperado es 0,
  falla con un mensaje claro. Con importe 0 no hay nada que cobrar y el
  componente no se muestra. Cobrar por adelantado (por ejemplo, en
  `en_reparacion`) queda fuera de alcance.

### Componente "Registrar pago manual"
- Un único Client Component (`components/payments/`) que usan el detalle de
  solicitud y el detalle de pedido del panel, con `onSubmit` + `useTransition`
  como el resto de formularios.
- Importe pre-rellenado con el importe esperado. Solo `admin` puede cambiarlo, y
  entonces el motivo es obligatorio y se guarda en `paymentNote`. Para
  `encargado` es de solo lectura.
- Selector de método, obligatorio: `efectivo`, `bizum` o `transferencia`.
  `tarjeta_online` solo lo pone la pasarela (5.3).
- Nota opcional, salvo cuando el importe difiere del esperado.
- Botón "Registrar pago". Server Action con Zod y `requerirStaff()`. Un importe
  distinto del esperado se revalida en servidor como admin y con motivo.
- Una vez registrado, en lugar del formulario se muestra un resumen: fecha
  (Europe/Madrid), importe, método, quién lo registró y nota. El cliente solo ve
  "Pagado el …".
- La emisión de la factura (4.3) se engancha a esta misma transacción cuando 4.3
  esté hecha.

### Guard de entrega
- `lista → entregada` exige `paidAt` **solo si `finalAmount > 0`**. Se comprueba
  en servidor, dentro de la misma transacción condicional del cambio de estado.
  Sin pago, el error es "Registra el pago antes de entregar". En el panel, el
  botón aparece deshabilitado con el tooltip "Requiere pago" (la UI no es la
  seguridad).
- `finalAmount = 0` (presupuesto igual a X): no hay cobro ni factura, y la
  reparación pasa a `entregada` sin pago.
- `rechazada` y `expirada` son finales: el cobro del diagnóstico no bloquea
  nada.
- Entra en vigor con 4.0.

### Casos límite
- Dos registros simultáneos del mismo cobro: el condicional deja ganar a uno; el
  otro ve "El pago ya está registrado".
- Registrar el cobro de un pedido que caduca en ese instante: o gana la
  caducidad (el registro falla) o gana el cobro (el pedido ya no caduca).
- Importe a 0 o negativo puesto por admin: se rechaza (Zod y check en SQL).

## 4.1 Dashboard de ingresos

### Definición de ingreso: por factura
- Ingreso del periodo = suma de `Invoice.total` con `issuedAt` dentro del
  periodo. Las originales suman (total positivo) y las rectificativas restan
  (total negativo) en el mes de **su** emisión, no en el de la original.
- El mes se calcula en Europe/Madrid, reutilizando el cálculo de fechas de
  `lib/work-logs.ts`.
- Clasificación por el concepto de la factura (campo `concept` de 4.3, que la
  rectificativa copia de su original):
  - Ventas: `venta` (pedidos).
  - Reparaciones: `reparacion`.
  - Diagnósticos: `diagnostico`.
- Importes con IVA incluido, como el total de la factura. El dashboard no
  desglosa el IVA.
- `paidAt`/`paidAmount` **no** se usan para ingresos. Todo cobro tiene factura
  (invariante de 4.3); los anteriores a 4.3 suman por su factura retroactiva
  `MIG`.
- Se suman todas las series (`FAC`, `RECT` en negativo y `MIG`).

### Vista `/admin/dashboard`
- Selector de periodo: mes actual, mes anterior, últimos 12 meses y año natural.
  Navegación por URL (`?periodo=`), igual que `WeekNav`.
- Tarjetas: ingresos netos totales, ventas, reparaciones, diagnósticos, importe
  rectificado del periodo (en negativo, aparte) y número de facturas de cada
  tipo.
- Pedidos perdidos del periodo, en dos cifras separadas: `cancelado` (decisión
  humana) y `caducado` (impago, lo pone el sistema). Se imputan por `updatedAt`.
- Pendientes de cobro (flujo de caja, no ingreso): reparaciones en `lista` con
  `finalAmount > 0` y sin `paidAt` (número e importe esperado), con enlace al
  listado filtrado.
- Gráfico de barras agrupadas por mes (ventas frente a reparaciones +
  diagnósticos, netos de rectificativas) en **SVG propio**, como Server
  Component, sin dependencias. Un mes neto negativo dibuja la barra por debajo
  del eje 0. Tiene eje Y con escala "redonda", leyenda, `<title>` por barra para
  el tooltip nativo y una tabla equivalente debajo.
- Las cifras se calculan agregando en PostgreSQL (`groupBy`/SQL sobre
  `invoices`), nunca cargando todas las filas.
- Enlace en la navegación del panel. `/admin` sigue redirigiendo a
  `/admin/solicitudes`.

### Casos límite
- Mes sin facturas: la barra a 0 y el mes visible. Periodo sin datos: estado
  vacío.
- Factura emitida en octubre y rectificada en noviembre: octubre no cambia y
  noviembre resta el total.
- Original y rectificativa en el mismo mes: se compensan y el neto es 0.

## 4.2 Exportación a CSV
- Route handlers GET bajo `/admin/exportar/`, porque una descarga no encaja en
  una Server Action. Llevan middleware y `requerirStaff()` dentro del handler.
- Exportaciones:
  - `ingresos.csv`: una fila por factura del periodo (por `issuedAt`),
    originales, rectificativas, re-emisiones y retroactivas, **con signo**.
    Incluye el número con prefijo (`FAC-…`, `RECT-…`, `MIG-…`), tipo,
    retroactiva sí/no, factura sustituida o rectificada (si aplica),
    concepto, fecha de emisión, cliente,
    modalidad, base, IVA y total. La suma de la columna total coincide con el
    dashboard del mismo periodo.
  - `pedidos.csv`: una fila por línea de pedido (id, fecha, estado, cliente,
    email, producto, cantidad, PVP unitario, total de la línea, fecha de cobro,
    importe cobrado y método).
  - `reparaciones.csv`: una fila por solicitud (id, fechas, estado, equipo,
    modalidad, responsable, presupuesto, X, importe final, fecha de cobro,
    importe cobrado y método).
- Filtros por query string, validados con Zod: rango de fechas (obligatorio,
  máximo 366 días) y estado o concepto opcional. Botón "Exportar CSV" en los
  listados con los filtros actuales aplicados.
- Formato pensado para el Excel en español: separador `;`, UTF-8 con BOM, decimal
  con coma, fechas `dd/mm/aaaa hh:mm` en Europe/Madrid y nombre de fichero con el
  rango (`ingresos_2026-10-01_2026-10-31.csv`).
- Protección contra inyección de fórmulas: las celdas que empiezan por `=`, `+`,
  `-`, `@`, tabulador o retorno de carro se prefijan con `'`. Los importes
  negativos son números (no texto), así que no se prefijan: la función distingue
  celdas numéricas de celdas de texto. Comillas escapadas según RFC 4180. Todo en
  una función pura con tests.
- Los importes son PVP con IVA y la cabecera lo indica. La nota del cobro no se
  exporta.
- Tope de 10 000 filas por exportación. Si se supera, se devuelve un error que
  pide acotar el rango, sin generar un fichero truncado.

## 4.3 Facturación simulada

### Modelo
- `Invoice`:
  - serie, año, número y código único legible `<SERIE>-YYYY-NNNN`. Hay tres
    series, cada una con su numeración correlativa por año:
    - `FAC` (ordinarias del flujo normal y re-emisiones), p. ej. `FAC-2026-0001`
    - `RECT` (rectificativas), p. ej. `RECT-2026-0001`
    - `MIG` (retroactivas generadas por la migración o el seed), p. ej.
      `MIG-2025-0001`
  - tipo (`ordinaria` para `FAC` y `MIG`, `rectificativa` para `RECT`) y
    concepto (`venta`, `reparacion`, `diagnostico`)
  - `issuedAt` (fecha de emisión)
  - `orderId?` o `requestId?` (exactamente uno, con un check)
  - `rectifiesInvoiceId?`: en las rectificativas, apunta a la factura que anulan
  - `replacesInvoiceId?`: en las re-emisiones, apunta a la factura rectificada
    a la que sustituyen
  - motivo de la rectificativa (obligatorio en `RECT`)
  - `reissueReason String?` (10–200 caracteres, obligatorio en una re-emisión)
  - `isBackfill Boolean @default(false)`: `true` solo en la serie `MIG`
  - modalidad `simplificada` o `completa` (ver "NIF del cliente")
  - snapshot del emisor (datos ficticios de SoftHard A&L, NIF de demo) y del
    cliente (nombre, email, NIF si lo tiene y dirección si existe)
  - tipo de IVA aplicado, base total, IVA total, total y método de pago.
    Signos: positivos en la ordinaria y negativos en la rectificativa.
- `InvoiceLine`: descripción, cantidad, PVP unitario, total de la línea, base e
  IVA de la línea (calculados con `lib/vat.ts`).
- `InvoiceCounter(series, year, lastNumber)`. El número se obtiene con un
  `UPDATE … RETURNING` en la **misma transacción** que crea la factura: si algo
  falla, el contador también se revierte y no hay huecos. Cada serie reinicia la
  numeración por año.
- Inmutabilidad en BD (SQL manual en la migración): triggers que impiden
  `UPDATE` y `DELETE` en `invoices` e `invoice_lines`. Las FK hacia pedido,
  solicitud y usuario son `Restrict`, así que borrar un cliente con facturas
  falla en lugar de arrastrarlas.
- Checks en SQL:
  - `RECT`: total ≤ 0, `rectifiesInvoiceId` no nulo, motivo no nulo,
    `replacesInvoiceId` nulo.
  - `FAC` y `MIG`: total ≥ 0 y `rectifiesInvoiceId` nulo.
  - `replacesInvoiceId` no nulo ⇔ `reissueReason` no nulo, y solo en `FAC`.
  - `isBackfill = (serie = 'MIG')`.
- Unicidad:
  - Una sola rectificativa por factura (índice único parcial sobre
    `rectifiesInvoiceId`). Solo hay rectificación total.
  - Una sola re-emisión por factura rectificada (índice único parcial sobre
    `replacesInvoiceId`).
  - "Factura vigente" de un pedido o de una solicitud = ordinaria (`FAC` o
    `MIG`) sin rectificativa. Como mucho una, garantizado en la transacción de
    emisión (bloqueo previo de la fila con `updateMany` condicional).
- Índice sobre `issuedAt` (y `concept`) para el dashboard.

### NIF del cliente
- Campo nuevo `User.nif String?` (opcional), normalizado (sin espacios ni guiones
  y en mayúsculas) y validado con Zod: formato y letra de control de DNI o NIE, o
  formato de CIF.
- El cliente lo rellena o lo borra en una página nueva `/app/perfil`, con un
  único campo: el área de cliente no tiene perfil hoy. El staff no lo edita.
- Al emitir, se copia en la factura:
  - Sin NIF → factura **simplificada** (nombre y email).
  - Con NIF → factura **completa** (nombre, NIF, email y dirección si existe).
- Cambiar el NIF después no altera las facturas emitidas (son un snapshot). La
  rectificativa copia la modalidad y los datos de su original.

### Contenido de cada factura
- Pedido (`venta`): una línea por `OrderItem` (producto, cantidad, PVP
  unitario).
- Reparación con presupuesto aceptado (`reparacion`):
  - "Reparación de <equipo> <marca> <modelo>" por `budgetAmount`
  - "Descuento diagnóstico" por −`diagnosticFee`
  - suma = `finalAmount`
- Diagnóstico de una `rechazada` o `expirada` (`diagnostico`): una línea
  "Diagnóstico" por `diagnosticFee`.
- **Ajuste de importe:** si `paidAmount` ≠ importe esperado (`Order.total`,
  `finalAmount` o `diagnosticFee`), se añade una línea "Ajuste de importe" por
  `paidAmount − esperado` (positiva o negativa), desglosada con la misma
  función. Así el total de la factura es siempre `paidAmount`.
- Rectificativa: copia todas las líneas de la original (incluido el ajuste) con
  signo negativo, su tipo de IVA, su concepto y sus datos de cliente, y añade el
  motivo y su propia `issuedAt`. Total = −total de la original.

### Cuándo se emite
- **Ordinaria (`FAC`):** en la misma transacción que registra el cobro
  (`paidAt`), sea manual (4.0) o por pasarela (5.3). `issuedAt` = momento del
  registro.
- **Rectificativa (`RECT`):** solo manual, por el staff desde el detalle de la
  factura y con motivo obligatorio. No hay rectificativas automáticas. Al
  rectificar, **los campos de cobro de la entidad no se tocan**: quedan como
  registro histórico.
- **Re-emisión (`FAC`):** solo manual (ver abajo).
- **Retroactiva (`MIG`):** solo la migración de 4.3 y el seed (ver abajo).

### Cobros de 0 € (decisión)
Un cobro de 0 € no es un cobro. Si el importe esperado es mayor que 0
(`finalAmount > 0` en una reparación, `Order.total` en un pedido), el cobro es
obligatorio y la factura también. Si es 0, no hay cobro ni factura, y la
reparación llega a `entregada` sin pago (el guard solo exige `paidAt` cuando
`finalAmount > 0`). Por eso el invariante de facturación es **"todo `paidAt` no
nulo tiene factura"**, y no "toda entidad tiene factura". Como `paidAmount > 0`
está garantizado por un check, los dos enunciados (`paid_at IS NOT NULL` y
`paid_amount > 0`) son equivalentes. Un flujo manual de "factura sin cobro"
(por ejemplo, para documentar una reparación gratuita) queda fuera de la
Fase 4 como refinamiento futuro.

### Emitir factura de nuevo (re-emisión)
- Botón de staff "Emitir factura de nuevo" en el detalle del pedido o de la
  solicitud. Se muestra, y se revalida en servidor, solo si se cumplen las tres
  condiciones:
  1. Hay cobro registrado (`paidAt` no nulo).
  2. La última factura ordinaria de la entidad está rectificada y no hay
     sustitutoria vigente.
  3. La entidad **no** está `cancelado` (pedido) ni `rechazada` o `expirada`
     (solicitud). El cobro de un diagnóstico queda cubierto por su factura
     original rectificada y no se re-emite.
- Crea una `FAC-` nueva:
  - `issuedAt` = ahora y total = el mismo `paidAmount`;
  - `replacesInvoiceId` = la factura rectificada a la que sustituye;
  - `reissueReason` obligatorio (10–200 caracteres, Zod en servidor);
  - líneas recalculadas desde la entidad con la regla de contenido de arriba,
    incluido el ajuste si `paidAmount` ≠ esperado;
  - datos del cliente (nombre, NIF y dirección) tomados **en el momento de la
    re-emisión**, que es justo lo que permite corregir un NIF o un dato
    erróneo;
  - el mismo tipo de IVA que la factura sustituida, porque la operación es la
    misma.
- Si la re-emisión vuelve a estar mal, se rectifica y se re-emite otra vez. La
  cadena queda trazada por `replacesInvoiceId`.
- La re-emisión suma en el mes de su `issuedAt` (la rectificativa restó en el
  suyo), así que el neto queda correcto.
- No toca los campos de cobro ni el estado de la entidad. Tras re-emitir, la
  entidad vuelve a tener factura vigente y aplican los bloqueos.
- Carreras: doble clic → el índice único sobre `replacesInvoiceId` y el
  bloqueo de la fila dejan pasar una sola.
- Descartadas: "rectificar y re-emitir en un solo paso" (mezcla dos actos
  contables distintos) y "no permitir volver a facturar" (impide corregir un
  NIF o un concepto).

### Facturas retroactivas (`MIG`)
- Para que el dashboard tenga histórico desde el primer minuto, todo cobro
  anterior a la facturación recibe su factura retroactiva.
- **Migración de 4.3** (SQL manual dentro de la misma migración, revisado
  antes de aplicar):
  - `INSERT INTO invoices … SELECT … FROM orders WHERE paid_at IS NOT NULL` y lo
    mismo `FROM service_requests`. Como en ese momento todavía no hay facturas,
    cubre todos los cobros: los del backfill de 4.0 y los registrados entre 4.0
    y 4.3.
  - Cada factura lleva `issued_at = paid_at`, total = `paid_amount`, serie
    `MIG`, `is_backfill = true` y el concepto deducido de la entidad (pedido →
    `venta`; solicitud con presupuesto aceptado → `reparacion`; `rechazada` o
    `expirada` → `diagnostico`).
  - Números correlativos por año en orden de `paid_at` (`ROW_NUMBER()`), y
    actualización de `invoice_counters` para la serie `MIG` con el último
    número de cada año.
  - Líneas (`invoice_lines`) con las mismas reglas de contenido (líneas de
    pedido, reparación + descuento, diagnóstico y ajuste) y el mismo desglose
    de IVA que `lib/vat.ts`, con el tipo por defecto (21 %).
  - Datos del cliente tomados en el momento de la migración.
  - IDs deterministas derivados de la entidad (por ejemplo,
    `'mig-' || <id de la entidad>`), sin `gen_random_uuid()`.
- **Seed:** genera las facturas de sus cobros demo con el mismo patrón (ver
  "Histórico demo en el seed").
- Las `MIG` son facturas normales a todos los efectos: inmutables, se pueden
  rectificar (con una `RECT`) y re-emitir (con una `FAC`). El dashboard las
  suma como cualquier otra; en el listado llevan la etiqueta "Retroactiva".

### Histórico demo en el seed
Hoy `prisma/seed.ts` solo crea usuarios y productos. En 4.3 se amplía con 12
meses de actividad, para que quien clone el repo vea el dashboard con datos
desde el primer minuto.

**Reglas generales**
- **Determinista:**
  - IDs fijos por tipo (`seed-inv-001`, `seed-inv-002`…, y de la misma forma
    `seed-ord-NNN`, `seed-req-NNN`, `seed-quote-NNN`…), sin
    `gen_random_uuid()` ni aleatoriedad;
  - el reparto de conceptos, estados y métodos sale de una tabla fija en el
    código del seed, no de `Math.random()`.
- **Fechas relativas a `Date.now()`** con offsets fijos:
  - "mes k" (k = 1…12) es el mes natural (Europe/Madrid) de hace 12 − k meses,
    así que mes 1 = hace 11 meses y mes 12 = mes actual;
  - dentro de cada mes se usan días y horas fijos que nunca caen en el futuro
    (en el mes actual, siempre antes de `now`).
  El seed funciona igual en 2026 que en 2030.
- **Idempotente:** se hace upsert por ID fijo; lo que ya existe no se toca (las
  fechas se quedan las de la primera ejecución). No crea una factura si la
  entidad ya tiene una.
- **Coherente con el resto de reglas:**
  - libro de stock con `venta`, `cancelacion_pedido`, `caducidad_pedido` y
    `reposicion` cuando haga falta, sin dejar agotado ningún producto que hoy no
    lo esté;
  - historial de estados y de asignaciones (responsable
    `trabajador@demo.local`) y presupuestos con `diagnosticFee` de `Config`;
  - cobros manuales con `paidById` de un staff demo; cobros `tarjeta_online`
    con `paidById` nulo;
  - numeración por `InvoiceCounter`, en orden de fecha, nunca con números
    escritos a mano.
- **Series:**
  - las ordinarias del histórico son `MIG` con `isBackfill = true` y
    `issuedAt = paidAt`;
  - las rectificativas del seed son `RECT` y las re-emisiones son `FAC`, ambas
    con `isBackfill = false` (lo exige el check serie ↔ `isBackfill`) y con su
    propia fecha relativa.
- **Se exporta como función** que recibe un cliente de Prisma, para poder
  ejecutarla dentro de `enTransaccion` en los tests de integración contra
  `softhard_test`.

**Distribución**
- Facturas: 3–6 por mes. Por concepto, 60 % `reparacion`, 30 % `venta` y 10 %
  `diagnostico`. Métodos repartidos entre `efectivo`, `bizum`, `transferencia`
  y `tarjeta_online`.
- Reparaciones:
  - ~70 % `entregada` (con cobro y factura si `finalAmount > 0`);
  - ~10 % `rechazada` o `expirada`, con o sin cobro del diagnóstico;
  - ~20 % en estados intermedios (`pendiente`, `diagnosticada`, `aceptada`,
    `en_reparacion`, `esperando_repuesto` y `lista`), sin cobro ni factura.
- Pedidos:
  - ~80 % `pagado` o `entregado` (con cobro y factura);
  - ~10 % `pendiente`, sin cobro ni factura y reteniendo stock. Se crean en las
    últimas horas, con `expiresAt` todavía futuro, porque si no la caducidad
    perezosa los marcaría `caducado` en la primera lectura;
  - ~10 % `cancelado` o `caducado`. Los cancelados son pedidos no cobrados que
    se cancelaron y repusieron stock.

**Casos especiales obligatorios**
- **Mes 3:** reparación `rechazada` con cobro del diagnóstico: `finalAmount = X`,
  `paidAt` relleno y factura `MIG` de concepto `diagnostico`.
- **Mes 6:** pedido pagado con su factura y una rectificativa `RECT` con motivo
  "Cambio de NIF". Sin re-emisión: el pedido queda sin factura vigente y su neto
  en el dashboard es 0.
- **Mes 7:** pedido con `paidAmount` ≠ `Order.total`, con `paymentNote`
  explicando el motivo y cobro registrado por el admin demo. Su factura lleva la
  línea "Ajuste de importe" y `total = paidAmount`.
- **Mes 9:** reparación cobrada con factura `MIG`, su rectificativa `RECT` y una
  re-emisión `FAC` correcta (`replacesInvoiceId` y `reissueReason`). Las tres
  dentro del mes 9; neto = `paidAmount`.
- **Mes 11:** pedido `caducado`, sin `paidAt` y sin factura. Tiene su
  movimiento `caducidad_pedido` en el libro de stock.

### Bloqueos por factura vigente
- Solicitud con factura vigente: la única transición permitida es
  `lista → entregada`. Cualquier otra, incluidas las correcciones del staff
  hacia atrás, falla hasta emitir la rectificativa. En el panel, el control
  aparece deshabilitado con "Tiene factura vigente: emite antes la
  rectificativa".
- Pedido con factura vigente: se permite `pagado → entregado`. La cancelación
  falla en servidor con "Cancela la factura primero". El staff emite la
  rectificativa (con motivo) y después cancela el pedido, que repone el stock
  como hasta ahora. En el panel, "Cancelar" aparece deshabilitado con ese mismo
  texto.
- La comprobación se hace en servidor, en la misma transacción del cambio de
  estado.

### Casos límite
- Doble clic o carrera al registrar el cobro: el condicional sobre `paidAt` y la
  factura están en la misma transacción, así que solo se emite una.
- Rectificativa doble de la misma factura: la impide el índice único.
- Re-emisión doble de la misma rectificada: la impide el índice único sobre
  `replacesInvoiceId`.
- Cambio de `vatRate` en `Config`: solo afecta a las facturas nuevas. Las
  rectificativas y las re-emisiones copian el tipo de la factura de la que
  proceden.
- Redondeo: un PVP de 0,01 € da base 0,01 € e IVA 0,00 €. Se acepta y queda
  fijado con un test.
- Ajuste que deja la factura en 0 (admin cobra 0 sobre un esperado positivo):
  no se permite, porque el importe cobrado debe ser > 0 (ver 4.0).
- El SQL de la migración `MIG` y `lib/vat.ts` deben dar el mismo desglose: un
  test de integración compara las líneas de una factura `MIG` con las que
  calcularía `lib/vat.ts` para la misma entidad.

### Vistas
- `/admin/facturas`: listado con filtros (año, serie `FAC`/`RECT`/`MIG`,
  concepto, fechas, cliente), paginado. Las rectificativas aparecen en negativo
  y enlazadas a su original; las `MIG`, con la etiqueta "Retroactiva"; las
  re-emisiones, con "Sustituye a <código>". Exportación `facturas.csv`, que es
  el mismo `ingresos.csv` de 4.2 (columna "número" con prefijo, por ejemplo
  `MIG-2025-0003`).
- Detalle `/admin/facturas/[id]` y `/app/facturas/[id]`: vista con estilos de
  impresión (`@media print`). El "PDF" se obtiene con la impresión del navegador,
  sin dependencias. En el panel, "Emitir rectificativa" (con motivo) solo
  aparece en una ordinaria vigente. La re-emisión muestra su motivo y la
  factura a la que sustituye.
- En el detalle del pedido y de la solicitud (cliente y panel), la lista de sus
  facturas con su cadena original → rectificativa → re-emisión. En el panel,
  además, el botón "Emitir factura de nuevo" cuando se cumplen sus condiciones.
- Toda factura lleva la leyenda "Factura simulada — sin validez fiscal".
- No cambia nada en el catálogo, el carrito, el checkout ni el presupuesto.

## Sub-fases (orden de ejecución: 4.0 → 4.3 → 4.1 → 4.2)
4.0 Registro de cobros: campos de cobro (con `paidAmount`) en `Order` y
    `ServiceRequest`, backfill, componente "Registrar pago manual" y guard de
    entrega.
4.3 Facturas:
    - `vatRate` y desglose de IVA
    - `User.nif` y `/app/perfil`
    - series `FAC`/`RECT`/`MIG` con numeración, e inmutabilidad
    - emisión al cobrar, con línea de ajuste
    - rectificativas manuales con total negativo, y bloqueos
    - "Emitir factura de nuevo"
    - facturas retroactivas `MIG` en la migración y en el seed, más el
      invariante de cobertura
4.1 Dashboard de ingresos sobre `Invoice` (`issuedAt`, con signo, todas las
    series).
4.2 Exportación a CSV: ingresos (facturas con signo), pedidos y reparaciones.

## Criterios de aceptación
- Un cobro solo se registra una vez, incluso con doble clic o dos pestañas (test
  de integración).
- `lista → entregada` sin `paidAt` falla en servidor con "Registra el pago antes
  de entregar" (test de integración).
- Un `encargado` no puede cambiar el importe, aunque mande el campo a mano
  (test de la acción).
- Con `paidAmount` ≠ esperado, la factura lleva la línea "Ajuste de importe" y
  su total es `paidAmount` (tests).
- Emitir una rectificativa no modifica ningún campo de cobro de la entidad (test
  de integración).
- Re-emisión (tests de integración):
  - solo es posible si se cumplen las tres condiciones (cobro registrado,
    original rectificada sin sustitutoria vigente, entidad no
    cancelada/rechazada/expirada);
  - exige `reissueReason` de 10–200 caracteres;
  - crea una `FAC` con el mismo `paidAmount`, `replacesInvoiceId` y los datos
    actuales del cliente;
  - no se puede re-emitir dos veces la misma rectificada.
- **Invariante de cobertura: todo `paidAt` no nulo tiene factura.** Es un test
  de integración, y se comprueba también tras la migración y tras el seed.

  ```sql
  SELECT COUNT(*) FROM service_requests sr
  WHERE sr.paid_at IS NOT NULL
    AND sr.id NOT IN (SELECT request_id FROM invoices WHERE request_id IS NOT NULL);
  -- = 0, y lo mismo para orders con order_id
  ```
  `paid_amount > 0` está garantizado por un check, así que no hace falta
  filtrarlo. Los nombres de columna exactos se fijan con el esquema real.
- Cobros de 0 €: una reparación con `finalAmount = 0` pasa a `entregada` sin
  `paidAt` y sin factura; registrar un cobro de 0 € se rechaza (tests).
- Seed (tests de integración, ejecutando el seed dentro de `enTransaccion`
  contra `softhard_test`):
  - el dashboard es > 0 en al menos 10 de los 12 meses;
  - el invariante "todo `paidAt` no nulo tiene factura" se cumple;
  - mes 9 (rectificativa + re-emisión): neto del mes para esa reparación =
    `paidAmount`;
  - mes 11 (caducado): el pedido no tiene `paidAt` ni factura;
  - mes 7 (ajuste): la factura tiene `total = paidAmount` y la línea "Ajuste de
    importe";
  - ejecutarlo dos veces no duplica nada (idempotencia) y el invariante del
    libro de stock se mantiene.
- Facturas `MIG`: `isBackfill = true`, `issuedAt = paidAt`, total =
  `paidAmount`, numeración correlativa por año en orden de `paidAt`, y ninguna
  factura de otra serie tiene `isBackfill = true` (test).
- Dashboard (tests de integración sobre facturas de prueba):
  - cada concepto suma lo esperado, incluidas las `MIG`;
  - una rectificativa resta en el mes de su emisión, no en el de la original;
  - original y rectificativa del mismo mes se compensan;
  - original, rectificativa y re-emisión dan un neto igual al cobro;
  - un cobro sin factura no suma.
- Las fronteras de mes respetan Europe/Madrid (test con una factura emitida a las
  23:30 del último día del mes, hora peninsular).
- La suma del total en `ingresos.csv` coincide con el dashboard del mismo
  periodo (test).
- El CSV se abre en Excel con acentos, decimales y negativos correctos, y las
  fórmulas quedan neutralizadas (tests de la función pura).
- En cada factura, base + IVA = total en cada línea y en el total (tests de
  `lib/vat.ts` con casos de redondeo y líneas negativas).
- Es imposible modificar o borrar una factura, ni siquiera con SQL directo desde
  la aplicación (test de integración contra el trigger).
- La numeración de cada serie es correlativa y sin huecos aunque una
  transacción falle (test de integración).
- Con factura vigente, una solicitud solo puede pasar de `lista` a `entregada` y
  un pedido no se cancela ("Cancela la factura primero"), hasta emitir la
  rectificativa (tests de integración).
- Un NIF inválido se rechaza. Con NIF la factura es completa y sin él,
  simplificada (tests).
- El cliente no puede ver facturas ajenas (404).
- Tras el seed en una BD limpia, el dashboard muestra datos históricos
  (comprobación manual en el navegador, solo lectura).
- `typecheck`, `lint`, `test` y `test:integration` limpios.

## Fuera de alcance
- Pasarela de pago (5.3). Aquí solo hay registro manual.
- Cobros parciales, a cuenta o por adelantado. Edición o anulación de un cobro.
- "Factura sin cobro" manual (por ejemplo, reparaciones de 0 €): refinamiento
  futuro.
- Validez fiscal real (Verifactu, TicketBAI, SII), firma y QR.
- Rectificativas parciales y abonos parciales.
- Varios tipos de IVA a la vez (reducido o exento) e IRPF.
- Desglose de IVA fuera de la factura (catálogo, carrito, presupuesto).
- PDF generado en servidor y envío de facturas por email.
- Contabilidad de gastos, proveedores, libros de IVA y modelos tributarios.

## Decisiones tomadas
- B2C: la BD guarda PVP con IVA incluido; el desglose solo existe en la factura.
- El cliente paga solo `finalAmount`, sin X aparte. La factura de la reparación
  lo refleja con la línea de descuento.
- Cobro unificado en `Order` y `ServiceRequest` (`paidAt`, `paidAmount`,
  `paymentMethod`, `paidById`, `paymentNote`), con un único componente
  reutilizable. `lista → entregada` exige `paidAt` si `finalAmount > 0`.
- `paidAmount` ≠ esperado → línea "Ajuste de importe" en la factura.
- **Ingresos = `Invoice.total` por `Invoice.issuedAt`**, todas las series,
  originales en positivo y rectificativas en negativo. `paidAt`/`paidAmount` son
  solo flujo de caja, conciliación y auditoría.
- La rectificativa (`RECT`) es una factura nueva con total negativo,
  `rectifiesInvoiceId` y su propia `issuedAt`. Los campos de cobro nunca se
  vacían.
- Corrección de una solicitud y cancelación de un pedido con factura vigente:
  bloqueadas hasta emitir la rectificativa manual ("Cancela la factura
  primero"). No hay rectificativas automáticas.
- "Emitir factura de nuevo": `FAC` nueva con `replacesInvoiceId` y
  `reissueReason` (10–200), solo con cobro, original rectificada sin
  sustitutoria y entidad no cancelada/rechazada/expirada. Descartados el paso
  único "rectificar y re-emitir" y la prohibición de re-facturar.
- Tres series independientes: `FAC-YYYY-NNNN`, `RECT-YYYY-NNNN`,
  `MIG-YYYY-NNNN`.
- Histórico: facturas retroactivas `MIG` (`isBackfill = true`,
  `issuedAt = paidAt`, total = `paidAmount`) generadas por la migración de 4.3
  para todos los cobros existentes, y por el seed para los pagos demo.
- Cobros de 0 €: un cobro de 0 € no existe (check `paidAmount > 0`). Con
  `finalAmount = 0` no hay cobro ni factura y la reparación se entrega sin pago.
  El invariante es "todo `paidAt` no nulo tiene factura". La "factura sin
  cobro" manual queda como refinamiento futuro.
- Seed con 12 meses de histórico determinista (IDs `seed-*`, fechas relativas a
  `Date.now()`, reparto fijo de conceptos, estados y métodos, y los casos
  especiales de los meses 3, 6, 7, 9 y 11).
- `User.nif` opcional: sin NIF, factura simplificada; con NIF, factura completa.

Sin dudas abiertas. Spec cerrada y lista para implementar.
