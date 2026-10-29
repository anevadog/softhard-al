# Spec Fase 5 — CI, emails y pagos

**Estado:** spec cerrada, pendiente de implementar. Va después de la Fase 4: los pagos emiten facturas (4.3) y
usan la caducidad de pedidos (`deuda-fase4.md`). El proyecto sigue siendo privado
y no se despliega: todo funciona en local y en GitHub Actions.

## Principio común: proveedores intercambiables
Emails y pagos se acceden a través de una interfaz (`EmailProvider`,
`PaymentProvider`) con una implementación local ahora y una real preparada para
más adelante. El proveedor se elige por variable de entorno, en un único punto
(`server/providers/`). El resto del código nunca importa una implementación
concreta. El usuario añade las variables nuevas a su `.env`; nosotros solo las
documentamos en el README o en `.env.example`.

## 5.1 CI con GitHub Actions
- `.github/workflows/ci.yml`, en `push` a `main` y en `pull_request`.
  `concurrency` cancela las ejecuciones viejas de la misma rama.
- Un job en `ubuntu-latest` con Node 24 (como en local), `npm ci` con caché de
  npm y `npx prisma generate` (el cliente generado no se versiona).
- Pasos: `npm run lint`, `npm run typecheck`, `npm run test` y
  `npm run test:integration`.
- Servicio `postgres:16` con healthcheck. `DATABASE_URL` apunta a
  `localhost:5432` del servicio, con credenciales de usar y tirar escritas en el
  propio workflow (no son secretos reales). El global setup de D4 crea o migra
  `<base>_test`. Hay que comprobar que la guarda `asegurarBdDeTest` acepta ese
  host y que la BD se crea si no existe, porque en local se creó a mano.
- Variables que pida la carga de módulos (por ejemplo, `AUTH_SECRET`): valores
  ficticios en el workflow.
- **Build incluido**, al final y contra la BD principal del servicio (`<base>`,
  distinta de `<base>_test`):
  1. `npx prisma migrate deploy`, con `DATABASE_URL` apuntando al servicio.
  2. `npm run build`, con `AUTH_SECRET` falso y la misma `DATABASE_URL`. El
     script `build` vuelve a ejecutar `prisma generate` y `migrate deploy`; es
     idempotente y no hace nada la segunda vez.
  La guarda de "BD local" se cumple: el servicio vive en `localhost` del
  runner y se destruye al acabar el job.
- Orden de pasos: lint → typecheck → test → test:integration → migrate deploy →
  build.
- Sin despliegue, sin publicar artefactos y sin secretos de GitHub en esta
  sub-fase.

### Criterios
- Una PR con un test roto, un error de lint o un build roto sale en rojo. `main`
  limpio sale en verde.
- El tiempo total se mantiene razonable (orientativo: < 5 min) para no gastar
  minutos del plan privado.
- Proteger `main` exigiendo el check es un ajuste del repo que haces tú; aquí
  solo se documenta.

## 5.2 Emails transaccionales
### Infraestructura
- Servicio `mailpit` en `docker-compose` (SMTP 1025, web 8025, solo en
  `localhost`). Todo email enviado en desarrollo se ve en
  `http://localhost:8025` y nunca sale a Internet.
- `EmailProvider.enviar({ to, subject, text, html })`. Implementaciones:
  - `MailpitEmailProvider`: usa la API HTTP de envío de Mailpit con `fetch`, así
    que no hace falta una dependencia SMTP. Si la versión de Mailpit no la
    trae, la alternativa es `nodemailer`, que justificaríamos aparte.
  - `ConsoleEmailProvider` para tests (registra en memoria).
  - `ResendEmailProvider` preparado con `fetch` contra la API REST, sin SDK. No
    se activa en esta fase.

### Eventos (y solo estos)
- **Pedido confirmado**: al **crear** el pedido (estado `pendiente`), en la
  transacción del checkout. Incluye las líneas, el total (IVA incluido), que el
  pago está pendiente, la fecha de caducidad y el enlace al pedido. Al pagar no
  se envía otro email.
- **Presupuesto listo**: al crear el presupuesto (solicitud → `diagnosticada`),
  con el importe (IVA incluido), la fecha de caducidad y el enlace a la
  solicitud.
- **Reparación lista**: al pasar la solicitud a `lista`, indicando la recogida en
  taller o la entrega a domicilio según la modalidad.

### Transactional Outbox (decidido)
- Modelo `PendingEmail` (tabla `pending_emails`):
  - tipo de evento, entidad (`entityId`), destinatario, asunto, cuerpo de texto
    y HTML ya renderizados
  - estado `pendiente`/`enviando`/`enviado`/`fallido`
  - intentos, último error, `lockedAt`, `sentAt` y `createdAt`
- Único `(tipo, entityId)`: un evento no encola dos emails aunque la transición
  se repita. Sin duplicados en el encolado.
- La fila se crea **en la misma transacción** que el evento (checkout, creación
  del presupuesto, paso a `lista`). Si la transacción se revierte, no hay email;
  si se confirma, el email queda encolado. Sin pérdidas.
- **Worker** `procesarEmailsPendientes()` en la capa de datos:
  - Reclama un lote con `FOR UPDATE SKIP LOCKED` (`pendiente`, o `enviando` con
    `lockedAt` de hace más de 5 min) y lo marca `enviando`. Dos workers nunca
    toman la misma fila.
  - Envía por el `EmailProvider` y marca `enviado` o, si falla, `pendiente` con
    intentos + 1. A los 5 intentos queda `fallido`.
- Formas de ejecutar el worker:
  - `npm run worker:emails`: script con `tsx` (ya es dependencia de desarrollo)
    que recorre la cola cada pocos segundos. Es el worker propiamente dicho.
  - Después de cada commit que encola, un disparo inmediato con `after()` de
    Next, para que en desarrollo el email llegue al momento aunque el worker no
    esté arrancado. Si falla, el worker lo recoge.
  - `/admin/emails`: listado por estado y botón "Reintentar" para los
    `fallido`, que los devuelve a `pendiente` (solo staff).
- Garantía de entrega: al menos una vez. El único hueco de duplicado es una
  caída justo entre el envío y la marca `enviado`; se acepta y se documenta.
- Plantillas en español, texto plano más HTML sencillo, sin imágenes remotas, sin
  tracking y sin datos internos (notas, responsable). Las URLs absolutas salen de
  una variable `APP_URL`.

### Criterios
- Cada evento encola exactamente una fila y produce un email en Mailpit (test de
  integración con `ConsoleEmailProvider`, y una comprobación manual en la web de
  Mailpit).
- Si la transacción del evento se revierte, no queda fila encolada (test).
- Un fallo del proveedor no impide crear el pedido o el presupuesto, ni cambiar
  el estado. El email se reintenta.
- Dos workers simultáneos no envían la misma fila (test con `sinRollback`).
- Tests unitarios de las plantillas (escapado HTML de los datos del cliente).

## 5.3 Pasarela de pago simulada
El registro de cobros ya existe desde la Fase 4 (4.0): campos `paidAt`,
`paidAmount`, `paymentMethod`, `paidById` y `paymentNote` en `Order` y
`ServiceRequest`,
componente "Registrar pago manual" y guard de `lista → entregada`. Esta
sub-fase añade la pasarela como **un canal más**: el staff sigue pudiendo
registrar cobros en efectivo, Bizum o transferencia.

### Modelo
- La fuente de verdad del cobro son los campos de la entidad (4.0). Un cobro
  por pasarela los rellena así:
  - `paidAt` = momento de la confirmación
  - `paidAmount` = importe esperado (la pasarela nunca cobra otro importe, así
    que su factura no lleva línea de ajuste)
  - `paymentMethod = tarjeta_online`
  - `paidById = null` (sistema)
- `PaymentSession`: registro técnico de cada intento con la pasarela, necesario
  para la idempotencia y los reembolsos:
  - proveedor (`mock`, más adelante `stripe`) y referencia del proveedor (única)
  - `orderId?` o `requestId?` (exactamente uno, con un check)
  - importe en céntimos (el importe esperado de 4.0, IVA incluido)
  - estado (`pendiente`, `completada`, `fallida`, `abandonada`,
    `reembolsada`), fechas y cliente
  No sustituye a los campos de la entidad: solo guarda el rastro de los
  intentos.
- `Config.requireDiagnosticPaymentUpfront Boolean @default(false)`: solo se
  modela. No tiene comportamiento en esta fase (ver "Pago del diagnóstico").
- `PaymentProvider`:
  - `crearSesion({ importe, referencia, urlRetorno })` → `{ id, urlPago }`
  - `reembolsar(id)`
  - Un punto de entrada único `confirmarPago(evento)` que hoy llama la página
    mock y mañana el webhook de Stripe.

### Mock
- Cobra tanto `Order` como `ServiceRequest`. El importe es el esperado de 4.0:
  `Order.total` para un pedido y `finalAmount` para una reparación.
- Página `/pago/mock/[sesion]` (solo con el proveedor `mock` activo) con tres
  botones: **Pagar**, **Simular error** y **Abandonar**. Llama a
  `confirmarPago` igual que lo haría un webhook y vuelve a la `urlRetorno`.
- El importe y el destinatario se recalculan siempre en el servidor. Nunca se
  confía en lo que llega de la página.

### Flujo tienda
1. El checkout crea el pedido `pendiente` (con su `expiresAt`) y redirige a
   "Pagar". El email "pedido confirmado" ya se encoló al crear el pedido.
2. Al pagar con éxito, en una transacción: sesión → `completada`, campos de
   cobro del pedido, pedido → `pagado` (condicional: `paidAt` nulo, sigue
   `pendiente` y no ha caducado) y factura (4.3). Es el mismo efecto que el
   registro manual.
3. Error o abandono: el pedido sigue `pendiente` y se puede reintentar hasta que
   caduque.
4. Pago confirmado sobre un pedido ya caducado, cancelado o ya cobrado a mano:
   no se toca el pedido; la sesión se reembolsa automáticamente y se registra.
5. Cancelar un pedido cobrado (flujo de 4.3): primero la rectificativa manual
   con motivo (factura negativa, que resta en su mes) y después la cancelación
   ("Cancela la factura primero"). Si se cobró por pasarela, la cancelación
   llama a `reembolsar` y la sesión pasa a `reembolsada`. Si fue manual, la
   devolución del dinero se hace fuera de la aplicación. En ambos casos, los
   campos de cobro del pedido no se tocan.
- `pendingOrderHours` sigue en 48 h.

### Flujo reparaciones
- Reparación `lista` con `finalAmount > 0` y sin `paidAt` (con 0 € no hay nada
  que cobrar): el cliente ve "Pagar" en su solicitud y
  paga `finalAmount` (IVA incluido; X ya está descontado) por la pasarela.
- Al confirmarse: campos de cobro de la solicitud y factura (4.3), en una
  transacción condicional sobre `paidAt` nulo y estado `lista`. El estado no
  cambia: `entregada` la sigue marcando el staff, y el guard de 4.0 ya queda
  satisfecho.
- Si el staff ya había registrado el cobro a mano, la confirmación de la
  pasarela no toca nada y la sesión se reembolsa.

### Pago del diagnóstico
- **No hay pago online del diagnóstico** ni pago por adelantado en esta fase. El
  cobro del diagnóstico de una solicitud `rechazada` o `expirada` se registra con
  el componente manual de 4.0.
- Solo se añade `Config.requireDiagnosticPaymentUpfront` (por defecto `false`),
  sin lógica que lo lea. Activarlo será una decisión y una spec posteriores.

### Idempotencia y concurrencia
- `confirmarPago` es idempotente por referencia del proveedor: un segundo evento
  igual no hace nada.
- El cobro de la entidad se fija una sola vez (condicional sobre `paidAt`
  nulo), sea por pasarela o manual. Si el cliente abre dos sesiones, o la
  pasarela y el staff cobran a la vez, gana uno y el otro intento de pasarela se
  reembolsa.

### Preparado para Stripe (sin activarlo)
- La interfaz encaja con Checkout Session + webhook firmado. Activarlo supondría
  la dependencia `stripe`, claves de test en `.env` (las pones tú), Stripe CLI
  para los webhooks en local y un route handler `/api/pagos/webhook` con
  verificación de firma. Queda como paso opcional al final, con spec propia si
  se hace.

### Criterios
- Tests de integración:
  - pago correcto de un pedido y de una reparación
  - error y abandono
  - doble confirmación
  - pago sobre un pedido caducado
  - pasarela y registro manual en carrera (gana uno y la sesión sobrante se
    reembolsa)
  - cancelación bloqueada sin rectificativa y cancelación con reembolso
  La factura se crea en la misma transacción que el cobro.
- Un cliente no puede pagar ni ver cobros de pedidos o solicitudes ajenos.
- La página mock no existe (404) si el proveedor activo no es `mock`.

## Sub-fases
5.1 CI.
5.2 Emails (Mailpit, `pending_emails` + worker, tres eventos).
5.3 Pasarela mock para pedidos y reparaciones (`PaymentSession`, reembolsos) y
    el flag `requireDiagnosticPaymentUpfront` (solo modelado).

## Fuera de alcance
- Despliegue (Vercel u otros) y entornos remotos.
- Stripe o PayPal reales y Resend activo (solo preparados).
- Pagos parciales, a plazos, propinas o cupones.
- Emails de marketing, recordatorios, caducidad de pedido o presupuesto, y
  notificaciones push o SMS.
- Facturas adjuntas en los emails.

## Decisiones tomadas
- "Pedido confirmado" se envía al crear el pedido (`pendiente`), no al pagar.
- El cliente paga solo `finalAmount`; X no se cobra aparte.
- Cobro unificado en `Order` y `ServiceRequest` desde 4.0. El pago manual del
  staff (efectivo, Bizum, transferencia) convive con la pasarela, que es un canal
  más. `lista → entregada` exige `paidAt` desde 4.0.
- Emails con Transactional Outbox (`pending_emails`): se encola en la
  transacción del evento y lo envía un worker.
- El CI incluye `migrate deploy` y `build` contra el Postgres del servicio.
- El pago del diagnóstico por adelantado no se implementa; solo se modela
  `Config.requireDiagnosticPaymentUpfront = false`.

Sin dudas abiertas. Spec cerrada y lista para implementar. La factura que emite un cobro por pasarela es una `FAC`
normal (`isBackfill = false`), con las mismas reglas de `fase-4.md`.
