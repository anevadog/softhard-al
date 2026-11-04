# SoftHard A&L

[![CI](https://github.com/anevadog/softhard-al/actions/workflows/ci.yml/badge.svg)](https://github.com/anevadog/softhard-al/actions/workflows/ci.yml)

**Web de servicios técnicos y venta de productos de informática.** Reparación de ordenadores, portátiles e impresoras, con solicitud online, presupuesto y seguimiento desde el área de cliente.

Proyecto de portafolio de **Alexander Nevado**. Los usuarios, solicitudes, importes y marcas que aparecen en la aplicación son **datos ficticios**: no hay clientes ni pagos reales.

`Proyecto finalizado` · `Fases 1–5 completadas` · `Next.js 15` · `TypeScript` · `PostgreSQL` · `609 tests + 106 de integración` · `CI en GitHub Actions`

## En 30 segundos

**Qué es.** La aplicación que me habría gustado tener cuando dirigía mi propio servicio técnico (2020–2024). Cubre el ciclo completo de un taller de reparación con tienda online: el cliente pide una reparación, el encargado presupuesta, el trabajador la repara y ficha su tiempo, y el taller cobra, factura y sigue sus ingresos.

**Pruébalo.** Demo online en **[softhard-al.vercel.app](https://softhard-al.vercel.app)** (Vercel + Neon, con los datos ficticios del seed; cualquiera puede modificarlos y se restauran de vez en cuando). En local, en unos 10 minutos con la [puesta en marcha](#puesta-en-marcha). Usuarios de prueba en [esta tabla](#usuarios-de-prueba).

**Decisiones técnicas que puedo explicar:**

- **El stock nunca queda en negativo.** Si dos clientes compran la última unidad a la vez, solo uno lo consigue: el descuento es condicional y va dentro de una transacción. → [Checkout atómico](#checkout-atómico-e-idempotente)
- **Un doble clic no crea dos pedidos.** Cada intento de compra lleva una clave única y la base de datos rechaza el duplicado. → [Idempotencia](#checkout-atómico-e-idempotente)
- **El dinero no se calcula con decimales flotantes.** Todos los importes van en céntimos y el servidor los recalcula siempre; nunca se fía de lo que llega del formulario. → [Regla del descuento](#regla-del-descuento)
- **Los estados de una reparación los decide una sola función.** Qué rol puede pasar de qué estado a cuál está en un único sitio, probado con tests. → [Taller](#taller-concurrencia-y-reglas-en-servidor)
- **Los permisos se comprueban en el servidor en cada acción**, no solo en la pantalla. → [Seguridad](#seguridad-y-permisos)

**Cómo lo hice.** Lo desarrollé por fases con agentes de IA (OpenCode y Claude Code). Yo definí el alcance de cada fase, revisé el código, lo probé y tomé las decisiones. Las especificaciones de cada fase están en [`docs/specs/`](docs/specs/) y lo que queda pendiente, con su motivo, en [trabajo futuro](#estado-del-proyecto-y-trabajo-futuro).

**Stack.** Next.js 15 · React 19 · TypeScript · PostgreSQL 16 · Prisma 7 · Auth.js · Zod · Vitest · Docker · GitHub Actions.

---

> **Estado:** la versión actual está terminada y es funcional de principio a fin. Lo que queda por hacer está etiquetado como **🚧 En construcción** (empezado, sin cerrar) o **🔭 Futuro** (planificado, sin empezar), con el motivo, en [Estado del proyecto y trabajo futuro](#estado-del-proyecto-y-trabajo-futuro).

## Capturas

**Landing pública**

![Landing de SoftHard A&L con los servicios, el proceso de reparación y el contacto](docs/capturas/landing.png)

**Panel del encargado**

![Panel interno con el listado de solicitudes y los filtros por estado](docs/capturas/panel-encargado.png)

**Detalle de la solicitud**

![Detalle de una solicitud con el presupuesto y los botones para aceptar o rechazar](docs/capturas/detalle-solicitud.png)

**Área del taller** (Fase 3, vista móvil): a la izquierda, el inicio del trabajador con su fichaje, sus reparaciones agrupadas por estado y las que puede tomar; a la derecha, el detalle de una reparación con el equipo, la visita, las acciones permitidas y sus fichajes

<p>
  <img src="docs/capturas/taller-panel.jpg" width="300" alt="Inicio del trabajador en móvil: tarjeta de fichaje en horas generales, cuatro reparaciones listas para entregar y dos aceptadas sin responsable para tomar">
  &nbsp;
  <img src="docs/capturas/taller-detalle.jpg" width="300" alt="Detalle de una reparación en móvil: equipo y avería, datos de la visita, acción para devolverla al encargado y dos fichajes registrados">
</p>

**Dashboard de ingresos** (Fase 4.1): ingresos netos por factura, por concepto y con las rectificativas restadas en su mes

![Dashboard con las tarjetas de ingresos netos, ventas, reparaciones, diagnósticos, rectificado y número de facturas](docs/capturas/dashboard-ingresos.jpg)

![Gráfico de barras de los últimos 12 meses (ventas frente a reparaciones y diagnósticos) con su tabla equivalente](docs/capturas/dashboard-grafico.jpg)

**Facturas simuladas** (Fase 4.3): listado con series FAC, RECT y MIG, y exportación a CSV (Fase 4.2)

![Listado de facturas con filtros, formulario de exportación a CSV y facturas ordinarias y retroactivas](docs/capturas/facturas.jpg)

![Detalle de una factura simplificada con el desglose de IVA por línea y el botón para emitir la rectificativa](docs/capturas/factura-detalle.jpg)

**Pasarela de pago simulada** (Fase 5.3) y el pedido cobrado con tarjeta y su factura

![Pasarela simulada con el importe del pedido y los botones Pagar, Simular error y Abandonar](docs/capturas/pasarela-mock.jpg)

![Detalle del pedido en el panel: pagado con tarjeta (pago online), registrado por el sistema y con su factura FAC](docs/capturas/pedido-pagado.jpg)

**Cola de emails transaccionales** (Fase 5.2)

![Panel de emails con el filtro por estado y el email de pedido confirmado enviado](docs/capturas/emails.jpg)

## Índice

- [En 30 segundos](#en-30-segundos)
- [Capturas](#capturas)
- [Qué es](#qué-es)
- [Funcionalidad](#funcionalidad)
- [Stack tecnológico](#stack-tecnológico)
- [Puesta en marcha](#puesta-en-marcha)
- [Usuarios de prueba](#usuarios-de-prueba)
- [Scripts](#scripts)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Decisiones de arquitectura](#decisiones-de-arquitectura)
- [Roadmap](#roadmap)
- [Estado del proyecto y trabajo futuro](#estado-del-proyecto-y-trabajo-futuro)
- [Documentación](#documentación)

## Qué es

SoftHard A&L es una aplicación full stack que cubre el ciclo completo de una reparación:

1. El visitante conoce el taller y sus servicios.
2. El cliente se registra y crea una solicitud indicando equipo, avería, modalidad y franja horaria.
3. El encargado revisa la solicitud, emite un presupuesto y gestiona su estado.
4. El cliente acepta o rechaza el presupuesto dentro del plazo y ve el importe final que le corresponde.
5. El taller asigna la reparación a un trabajador, que la sigue desde `/trabajador`: cambia su estado, ficha su tiempo, deja notas o avisa de que falta una pieza hasta dejarla lista para entregar.
6. El encargado vigila el taller: reparaciones sin actividad, devueltas, faltas de repuesto, fichajes y horas por trabajador y por reparación.
7. El cliente paga la reparación lista o su pedido (en el taller o con la pasarela simulada) y recibe una factura; el encargado sigue los ingresos en un dashboard y los exporta a CSV.

Además de las reparaciones, la tienda tiene catálogo público, carrito local, checkout con historial de pedidos, gestión administrativa de pedidos y libro de stock.

Las cinco fases están completadas: servicio técnico (1), tienda (2), taller interno (3), cobros, facturas e ingresos (4) y CI, emails transaccionales y pasarela de pago simulada (5).

## Funcionalidad

### Fase 1: servicio técnico

#### Público

- Landing con hero, servicios, cómo funciona y contacto.
- Registro de nuevos clientes con email único y contraseña hasheada.

#### Cliente

- Inicio y cierre de sesión.
- Creación de solicitudes con validación en servidor: tipo de equipo, marca, modelo, problema, modalidad (domicilio o taller), dirección de recogida (obligatoria solo a domicilio) y franja horaria.
- Listado de sus propias solicitudes y página de detalle.
- Visualización del presupuesto: importe, tarifa de diagnóstico e importe final.
- Aceptación o rechazo del presupuesto, con expiración automática a los 7 días.

#### Encargado / administrador

- Panel con todas las solicitudes y filtro por estado con contadores.
- Detalle de cada solicitud con datos del cliente, equipo y problema.
- Creación del presupuesto con vista previa del importe final.
- Cambio de estado entre los 9 estados del flujo (`pendiente`, `diagnosticada`, `aceptada`, `rechazada`, `expirada`, `en_reparacion`, `esperando_repuesto`, `lista` y `entregada`). Desde la Fase 3 lo decide una máquina de transiciones: fuera del flujo normal, el staff corrige con motivo obligatorio.

### Fase 2 (completada)

- Catálogo público en `/productos`, accesible sin iniciar sesión.
- Filtros por categoría; cada tarjeta muestra precio, stock y aviso de producto agotado.
- Ficha pública en `/productos/[id]` con imagen, descripción, precio, disponibilidad y acceso al carrito.
- Carrito en `/carrito` con persistencia en LocalStorage, contador de unidades en la cabecera, control de cantidades, subtotales y total.
- El carrito revalida precios y stock en servidor, respeta la disponibilidad y retira productos agotados o inactivos con aviso.
- El navegador solo guarda `productId` y `quantity`; nunca precios ni copias del producto.
- Catálogo interno en `/admin/productos` con listado, precio, stock y categoría.
- Alta de productos con stock inicial y edición sin campo de stock: el stock solo cambia por movimientos.
- Borrado lógico: el producto se archiva y deja de mostrarse en el catálogo.
- Seis productos de demostración creados por el seed, uno de ellos agotado.
- Solo `encargado` y `admin` acceden al panel; `cliente` y `trabajador` son redirigidos.
- Checkout desde `/carrito`: los visitantes inician sesión y vuelven al carrito sin perder productos; los clientes crean un pedido con el total calculado en servidor.
- El stock se descuenta en una transacción atómica. Si una línea no tiene existencias, no se crea el pedido y el carrito se ajusta al stock real.
- Clave de idempotencia por usuario para evitar pedidos duplicados por doble clic o reintentos.
- Página de éxito/detalle en `/app/pedidos/[id]` e historial en `/app/pedidos`, filtrado por propietario.
- Libro de stock con `stock_inicial`, `venta`, `cancelacion_pedido`, `reposicion` y `ajuste`; la invariante `stock = suma de movimientos` se mantiene en la misma transacción.
- Ajuste manual de stock solo para `encargado` y `admin`, con motivo, variación, nota, vista previa y rechazo de stock negativo. Historial de los últimos 10 movimientos en la ficha del producto.
- Panel `/admin/pedidos` con filtro por estado, contadores, cliente, fecha, total y estado; detalle con líneas a precio congelado y total.
- Transiciones de pedido aplicadas con actualización condicional sobre el estado esperado (en la Fase 2, `pendiente → pagado | cancelado` y `pagado → entregado | cancelado`; el paso a `pagado` cambió en la Fase 4.0, ver abajo).
- Cancelación transaccional: repone todas las líneas (también archivadas), crea un movimiento positivo por línea y no repone dos veces. Cancelar un pedido pagado exige motivo; si se cobró con la pasarela (Fase 5.3), se reembolsa.
- Los pedidos nacen en estado `pendiente`. Desde la Fase 4.0 solo pasan a `pagado` al registrar el cobro (manual o con la pasarela), y desde la deuda previa a la Fase 4 caducan a las 48 h sin pago.

### Fase 3: taller interno (completada)

Spec completa en [`docs/specs/fase-3.md`](docs/specs/fase-3.md). La unidad de trabajo es la propia solicitud de reparación; no hay tickets internos.

- **3.1 Datos y permisos:** estado `esperando_repuesto`; historiales de estados y de asignaciones; fichajes (`WorkLog`) y notas internas; fecha de última actividad; parámetros de aviso en `Config`. La base de datos impide dos fichajes abiertos del mismo trabajador y una salida anterior a la entrada. Ruta `/trabajador` para trabajador, encargado y admin, protegida en middleware, layout y acciones.
- **3.2a Transiciones:** una única función pura decide qué cambio de estado es válido para cada rol. El trabajador asignado avanza por `aceptada → en_reparacion ⇄ esperando_repuesto` y `en_reparacion → lista`; solo encargado y admin marcan `entregada`. Todo cambio deja historial, actualiza la última actividad y cierra el fichaje abierto cuando el estado deja de ser `en_reparacion`.
- **3.2b Asignación:** el encargado asigna y reasigna desde el detalle del panel; un trabajador toma una reparación aceptada sin responsable (si otro la tomó antes, falla con un mensaje claro) o la devuelve con motivo obligatorio. Cada cambio de responsable queda en su historial.
- **3.3 Panel del trabajador:** en `/trabajador`, mobile-first, sus reparaciones agrupadas por estado (primero las que exigen acción) y las aceptadas sin responsable para tomar. El detalle muestra equipo, avería, visita, botones de cambio de estado según la máquina de transiciones, devolución e historiales. Nunca muestra email ni teléfono del cliente; una reparación ajena devuelve 404.
- **3.4 Fichaje:** el trabajador ficha entrada y salida en una reparación suya en `en_reparacion` o en horas generales con nota obligatoria; tarjeta del fichaje actual en `/trabajador`, aviso si lleva abierto más de las horas configuradas e historial semanal en `/trabajador/fichajes`. El encargado ve los fichajes abiertos, los cierra y corrige entrada, salida y nota en `/admin/fichajes`, con constancia de quién y cuándo.
- **3.5 Notas y falta de repuesto:** notas internas ligadas a la reparación, normales o de falta de repuesto; el trabajador escribe en las suyas abiertas y el staff en cualquiera. Las faltas pendientes se destacan en el listado del panel hasta que el encargado las marca como atendidas. El cliente nunca las ve.
- **3.6 Avisos sin actividad:** cada página de `/trabajador` avisa de las reparaciones propias que superan las horas sin actividad configuradas, con enlace a cada una; el aviso desaparece con cualquier actividad. El panel muestra el bloque «Requieren atención» con las reparaciones sin actividad y las devueltas sin responsable. Una reparación devuelta ya no se puede tomar: solo la reasigna el encargado.
- **3.7 Vistas y reportes:** `/admin/reportes` con horas por trabajador y por reparación (semana y acumulado), reparaciones por estado y listas completas de avisos; lista de fichajes filtrable por trabajador y semana; historial de estados en el detalle de la solicitud y filtro de solicitudes con faltas de repuesto pendientes. Las semanas van de lunes a domingo en hora de Madrid.

### Deuda previa a la Fase 4 (completada)

Spec en [`docs/specs/deuda-fase4.md`](docs/specs/deuda-fase4.md). Un pedido pendiente caduca a las 48 h sin pago (estado propio `caducado`, distinto de `cancelado`) y su stock se libera de forma perezosa al leer, sin cron. El checkout y el ciclo del pedido tienen tests de integración, incluida concurrencia real.

### Fase 4: cobros, facturas e ingresos (completada)

Spec en [`docs/specs/fase-4.md`](docs/specs/fase-4.md). Importes B2C con IVA incluido; el desglose solo aparece en la factura.

- **4.0 Registro de cobros:** fecha, importe, método y autor en el propio pedido o reparación, registrados una sola vez. Entregar una reparación con importe exige el cobro.
- **4.3 Facturación simulada:** factura inmutable al cobrar (serie `FAC`), rectificativas en negativo (`RECT`), re-emisión para corregir datos y facturas retroactivas (`MIG`) para los cobros anteriores. Numeración correlativa sin huecos y triggers que impiden modificarlas. NIF opcional del cliente: con él, factura completa.
- **Seed histórico:** 12 meses de reparaciones, pedidos y facturas deterministas, para ver el dashboard con datos desde el primer arranque.
- **4.1 Dashboard:** `/admin/dashboard` con ingresos por factura (todas las series, con signo) agregados en PostgreSQL por mes de Madrid, gráfico SVG propio, pedidos perdidos y reparaciones pendientes de cobro.
- **4.2 Exportación a CSV:** ingresos, facturas, pedidos y reparaciones para Excel en español (`;`, coma decimal, BOM), con protección contra inyección de fórmulas y tope de filas.

### Fase 5: CI, emails y pagos (completada)

Spec en [`docs/specs/fase-5.md`](docs/specs/fase-5.md).

- **5.1 CI:** GitHub Actions con lint, tipos, tests unitarios, tests de integración, migraciones y build contra un PostgreSQL de usar y tirar (unos 2 minutos).
- **5.2 Emails transaccionales:** pedido confirmado, presupuesto listo y reparación lista, encolados en `pending_emails` en la misma transacción que el evento (Transactional Outbox) y enviados por un worker con reintentos. En desarrollo se ven en Mailpit; `/admin/emails` permite reintentar los fallidos.
- **5.3 Pasarela de pago simulada:** el cliente paga online pedidos y reparaciones listas; la pasarela es un canal más junto al cobro manual, con factura en la misma transacción, confirmación idempotente y reembolso automático si el pago llega tarde.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15.5 (App Router, Server Components y Server Actions) |
| UI | React 19.1 + Tailwind CSS 4 |
| Lenguaje | TypeScript 5 en modo estricto |
| Base de datos | PostgreSQL 16 + Prisma 7 con driver adapter (`@prisma/adapter-pg`) |
| Autenticación | Auth.js v5 (JWT) + `bcrypt` |
| Validación | Zod 4 |
| Tests | Vitest 5 |
| Tooling | ESLint 9 · Turbopack en desarrollo |

## Puesta en marcha

Esta guía lleva desde un equipo vacío hasta la aplicación funcionando en `http://localhost:3000` con datos de demostración. Los comandos están pensados para **Git Bash** (Windows), macOS o Linux.

### Resumen rápido

Si ya tienes Node 24 y Docker:

```bash
git clone https://github.com/anevadog/softhard-al.git
cd softhard-al
npm install
cp .env.example .env          # y pon un AUTH_SECRET propio (paso 3)
docker compose up -d db
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Después entra con cualquiera de los [usuarios de prueba](#usuarios-de-prueba).

### 1. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| **Node.js** | 24 (exacta en `.nvmrc`: 24.22.1) | Ejecutar la aplicación. Incluye npm. |
| **Git** | Cualquiera reciente | Clonar el repositorio. En Windows, Git Bash para los comandos de esta guía. |
| **PostgreSQL 16** | Con **Docker** (recomendado) o instalado en el sistema | Base de datos. |

Compruébalo con:

```bash
node -v
npm -v
docker -v
```

### 2. Clonar e instalar

```bash
git clone https://github.com/anevadog/softhard-al.git
cd softhard-al
npm install
```

### 3. Configurar el entorno

```bash
cp .env.example .env
```

El `.env` de ejemplo ya funciona con el PostgreSQL de Docker. Solo tienes que cambiar `AUTH_SECRET` por un valor aleatorio propio:

```bash
openssl rand -base64 32
```

Copia el resultado en `AUTH_SECRET="..."`. Sin OpenSSL, sirve cualquier generador de secretos de al menos 32 bytes.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. Por defecto `postgresql://postgres:postgres@localhost:5432/softhard?schema=public`, que coincide con `docker-compose.yml`. |
| `AUTH_SECRET` | Sí | Secreto con el que se firman las sesiones (JWT). |
| `AUTH_URL` | Sí | URL base de la aplicación: `http://localhost:3000`. |
| `NEXTAUTH_URL` | Sí | Mismo valor que `AUTH_URL` (compatibilidad de Auth.js). |
| `EMAIL_PROVIDER` | No | `console` (por defecto: el email se marca como enviado y aparece en `/admin/emails`, pero no sale de la aplicación) o `mailpit` (ver [Emails en desarrollo](#emails-en-desarrollo-mailpit)). |
| `MAILPIT_URL` | No | API de Mailpit: `http://localhost:8025`. |
| `EMAIL_FROM` | No | Remitente de los emails, por ejemplo `SoftHard A&L (demo) <no-reply@softhard-al.demo>`. |
| `APP_URL` | No | URL base de los enlaces de los emails: `http://localhost:3000`. |
| `PAYMENT_PROVIDER` | No | `mock` (por defecto): pasarela simulada en `/pago/mock/<sesión>`, sin cobros reales. |

`EMAIL_PROVIDER=resend` y `PAYMENT_PROVIDER=stripe` aparecen en el código pero están **🚧 en construcción**: no se deben activar (ver [trabajo futuro](#estado-del-proyecto-y-trabajo-futuro)).

### 4. Levantar la base de datos

**Opción A: Docker (recomendada)**

```bash
docker compose up -d db
```

Arranca PostgreSQL 16 en `localhost:5432` con usuario `postgres`, contraseña `postgres` y la base `softhard` ya creada. Los datos se guardan en un volumen y sobreviven a los reinicios.

**Opción B: PostgreSQL instalado en el sistema**

Crea la base y ajusta usuario y contraseña en `DATABASE_URL`:

```bash
createdb softhard
```

### 5. Crear las tablas

```bash
npx prisma generate
npx prisma migrate deploy
```

`generate` crea el cliente de Prisma en `src/generated/` (no está en el repositorio) y `migrate deploy` aplica todas las migraciones de `prisma/migrations/`.

### 6. Cargar los datos de demostración

```bash
npx prisma db seed
```

Crea la configuración del negocio, los usuarios de prueba, seis productos y un histórico de 12 meses con reparaciones, pedidos y facturas. Se puede repetir sin duplicar nada y se niega a ejecutarse si `DATABASE_URL` no apunta a una base local.

### 7. Arrancar la aplicación

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y entra con un [usuario de prueba](#usuarios-de-prueba). Para pararla, pulsa `Ctrl + C` en la terminal. Para parar la base de datos de Docker, `docker compose stop`.

### 8. Recorrido recomendado

Un recorrido de unos 10 minutos para ver todo el flujo:

1. **Visitante:** landing, catálogo en `/productos` y carrito.
2. **`cliente@demo.local`:** crea una solicitud de reparación en `/app/solicitudes/nueva`, haz un pedido desde el carrito y págalo con **Pagar con tarjeta** (pasarela simulada). Después mira su factura en `/app/facturas`.
3. **`encargado@demo.local`:** en `/admin/solicitudes` abre la solicitud nueva y emite un presupuesto. De paso, revisa `/admin/dashboard`, `/admin/facturas` (con exportación a CSV) y `/admin/reportes`.
4. **`cliente@demo.local`:** acepta el presupuesto.
5. **`encargado@demo.local`:** asigna la reparación aceptada a `trabajador@demo.local`.
6. **`trabajador@demo.local`:** en `/trabajador` abre la reparación, pásala a "En reparación", ficha entrada y salida, deja una nota y márcala como lista.
7. **`encargado@demo.local`:** registra el cobro (o deja que el cliente pague online) y marca la reparación como entregada; el cobro emite su factura.

### 9. Comprobar que todo funciona (opcional)

```bash
npm run lint
npm run typecheck
npm run test
```

Los tests de integración usan una base aparte, `softhard_test`, que se crea una sola vez:

```bash
docker compose exec db createdb -U postgres softhard_test
npm run test:integration
```

Con PostgreSQL instalado en el sistema, usa `createdb softhard_test` en lugar del primer comando.

### Emails en desarrollo (Mailpit)

La app envía tres emails transaccionales: pedido confirmado, presupuesto listo y reparación lista. Se guardan en la tabla `pending_emails` en la misma transacción que el evento y un worker los envía. Por defecto (`console`) se marcan como enviados y se consultan en `/admin/emails`, pero no se envían. Para verlos como emails de verdad, sin que salga nada a Internet, se usa [Mailpit](https://mailpit.axllent.org/):

```bash
docker compose up -d mailpit
```

Añade `EMAIL_PROVIDER="mailpit"` a tu `.env`, reinicia `npm run dev` y, en otra terminal, arranca el worker de la cola:

```bash
npm run worker:emails
```

Los emails se ven en [http://localhost:8025](http://localhost:8025). La app intenta además un envío inmediato tras cada acción, así que suelen llegar aunque el worker no esté arrancado; si ese envío falla, lo recoge el worker. Los fallidos (5 intentos) se reintentan desde `/admin/emails`. La entrega es **al menos una vez**: si el proceso cae justo entre el envío y la marca `enviado`, ese email puede llegar dos veces.

> **🚧 En construcción:** el envío a un Mailpit real todavía no se ha verificado a mano. El encolado, el worker, los reintentos y el panel están cubiertos por tests de integración con un proveedor simulado.

### Build de producción (local)

```bash
npm run build
npm run start
```

`npm run build` aplica antes las migraciones pendientes (`prisma migrate deploy`), así que necesita una `DATABASE_URL` válida. El despliegue en un servidor real está en [trabajo futuro](#estado-del-proyecto-y-trabajo-futuro).

### Problemas frecuentes

| Problema | Solución |
|---|---|
| El puerto 5432 está ocupado | Otro PostgreSQL está en marcha. Páralo o cambia el mapeo en `docker-compose.yml` (por ejemplo `5433:5432`) y el puerto en `DATABASE_URL`. |
| `Cannot find module '../src/generated/prisma/client'` o cliente de Prisma no inicializado | Ejecuta `npx prisma generate` y reinicia `npm run dev`. |
| Falta `AUTH_SECRET` o las sesiones fallan | Pon un `AUTH_SECRET` en `.env` (paso 3) y reinicia el servidor. |
| `Seed bloqueado: el host ... no es local` | El seed solo funciona contra `localhost`, `127.0.0.1` o el servicio `db` de Docker. Revisa `DATABASE_URL`. |
| La base de datos no tiene tablas | Faltan las migraciones: `npx prisma migrate deploy`. |
| Tras cambiar el esquema la app usa datos viejos | Reinicia `npm run dev` después de `npx prisma generate`. |

## Usuarios de prueba

El seed es idempotente (solo crea lo que falta; lo que ya existe no se toca) y solo se ejecuta contra una base local. Crea estas cuentas, todas con la misma contraseña: **`Demo1234!`**

| Email | Rol | Acceso |
|---|---|---|
| `cliente@demo.local` | cliente | `/app` (solicitudes, pedidos, facturas, perfil y pago online) |
| `cliente2@demo.local` … `cliente6@demo.local` | cliente | `/app`; son los clientes del histórico de 12 meses |
| `trabajador@demo.local` | trabajador | `/trabajador` (sus reparaciones, las de tomar, fichaje, notas y su historial de fichajes) y `/app`; sin acceso al panel |
| `encargado@demo.local` | encargado | `/admin` (solicitudes, asignaciones, notas, fichajes, reportes, pedidos, productos, stock, cobros, facturas, dashboard, exportación y emails) y `/trabajador` |
| `admin@demo.local` | admin | Igual que `encargado` |

En el panel, `admin` y `encargado` comparten permisos. Solo el rol `trabajador` ficha. El seed también crea la configuración de negocio (**30 €** de tarifa de diagnóstico, **7 días** de validez del presupuesto, aviso a las **48 h** sin actividad, fichaje abierto a las **8 h**, caducidad de pedidos a las **48 h** e IVA del **21 %**), seis productos de demostración y un histórico determinista de 12 meses: 47 reparaciones, 21 pedidos y sus 56 facturas (FAC, RECT y MIG), con fechas relativas al día en que se ejecuta.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con Turbopack |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Comprobación de tipos con TypeScript |
| `npm run test` | Ejecuta la suite de Vitest una vez |
| `npm run test:watch` | Vitest en modo vigilancia |
| `npm run test:integration` | Tests de integración contra PostgreSQL real (base `softhard_test`) |
| `npm run worker:emails` | Worker que envía los emails pendientes de la cola `pending_emails` |

Comandos de base de datos:

```bash
npx prisma migrate deploy                        # aplica las migraciones pendientes
npx prisma migrate dev --create-only --name <n>  # genera una migración nueva sin aplicarla (revisa el SQL antes)
npx prisma db seed                               # carga configuración, usuarios, productos e histórico demo
npx prisma studio                                # explora la base de datos
```

## Estructura del proyecto

```text
src/
  app/
    (public)/              landing, catálogo y carrito
    (auth)/                login y registro
    app/                   área del cliente (solicitudes, pedidos, facturas y perfil)
    admin/                 panel interno (solicitudes, fichajes, reportes, pedidos, productos, facturas, dashboard, emails y exportar/*.csv)
    trabajador/            área de taller (mis reparaciones, detalle y mis fichajes)
    pago/mock/             página de la pasarela de pago simulada
    api/auth/              handler de Auth.js
  components/
    site/                  landing, cabecera y catálogo público
    cart/                  provider, contador y vista del carrito
    orders/                badge de estado de pedido
    service-requests/      solicitudes, presupuestos y decisión
    admin/                 solicitudes, asignación, fichajes, notas, avisos, pedidos, productos, stock, dashboard y exportación
    taller/                tarjetas, fichaje, notas, avisos e historiales del área de taller
    payments/              registro de cobro manual, resumen del cobro y botón de pago online
    invoices/              documento de factura, cadena de rectificativas, formularios y NIF
  lib/
    auth.ts, authz.ts      autenticación y permisos
    navigation.ts          callback interno seguro tras login/registro
    service-status.ts      máquina de transiciones de estado de las reparaciones
    worker-requests.ts     agrupación y acciones del panel del trabajador
    work-logs.ts           duración de fichajes y semanas/horas en Europe/Madrid
    request-notes.ts       tipos y orden de las notas internas
    inactivity.ts          plazo y estados de los avisos sin actividad
    reports.ts             agregaciones de horas por trabajador y por reparación
    format.ts              importes y fechas (siempre en hora de Madrid)
    orders.ts              estados, transiciones, tipos y cálculo puro de pedidos
    stock.ts               motivos, límites y textos del libro de stock
    quotes.ts              reglas puras de importes y expiración
    products.ts            categorías y tipos del catálogo
    catalog.ts             filtros y textos de stock del catálogo público
    cart.ts                persistencia, stock e importes del carrito
    login-rate-limit.ts    política de intentos de inicio de sesión
    payments.ts            reglas puras de cobro
    vat.ts, invoices.ts    desglose de IVA y contenido de las facturas
    nif.ts                 validación del NIF
    dashboard.ts           periodos y agregados del dashboard de ingresos
    csv.ts                 generación de CSV para Excel en español
    email-templates.ts     plantillas de los emails transaccionales
    seed-dates.ts          fechas relativas del histórico del seed
    validations/           esquemas Zod
  server/
    authorization.ts       guards requerirStaff y requerirPersonalTaller (rol revalidado en BD)
    actions/               Server Actions (mutaciones, carrito, checkout, panel, stock, taller, cobros, facturas, pagos y emails)
    data/                  acceso a datos con control de propiedad y de responsable (también cobros, facturas, dashboard, emails y pasarela)
    exports/               respuestas CSV de las rutas de exportación (permisos, filtros y tope de filas)
    providers/             proveedores de email (console, Mailpit) y de pago (mock)
    seed/                  datos demo y histórico de 12 meses
scripts/worker-emails.ts   worker de la cola de emails
prisma/
  schema.prisma
  migrations/
  seed.ts                  entrada del seed (todo en una transacción)
public/productos/          placeholder de producto
docs/specs/               especificaciones por fase
.github/workflows/ci.yml   integración continua
```

## Decisiones de arquitectura

### Regla del descuento

La tarifa de diagnóstico **X** y los días de validez **N** viven en la tabla `Config`. Al crear un presupuesto, **X se copia** en el propio presupuesto para que un cambio futuro de tarifa no altere documentos ya emitidos.

- **Aceptar:** el importe final es `presupuesto − X`.
- **Rechazar:** el importe final es `X` (solo se abona el diagnóstico).
- **Expirar:** si pasan **N** días sin respuesta, el presupuesto caduca y ya no admite decisión.

Los importes se calculan en **céntimos** con funciones puras y se persisten como `Decimal(10,2)`, evitando la deriva de la coma flotante. El servidor recalcula siempre el importe: nunca acepta cantidades del formulario.

La expiración es **perezosa**: no hay cron. Al leer una solicitud se comprueba `expiresAt` y, si corresponde, se actualizan el presupuesto a `expirado` y la solicitud a `expirada` de forma idempotente.

### Carrito local con precios de servidor

El carrito de la Fase 2 se guarda en **LocalStorage** bajo la clave versionada
`softhard-carrito-v1` para que el visitante pueda montar su compra sin cuenta. El
checkout exige iniciar sesión, pero guardar el carrito en base de datos obligaría a
crear un carrito anónimo, limpiar carritos huérfanos y sincronizarlo al iniciar
sesión: complejidad que no aporta valor en esta tarea.

La decisión clave es que el navegador **solo almacena `productId` y `quantity`**.
Nunca guarda precios, nombres ni stock: esos datos podrían quedar obsoletos o ser
manipulados. Al abrir `/carrito`, una **Server Action pública** recibe los IDs y
consulta Prisma para devolver el precio y el stock actuales. Los subtotales y el
total se calculan en **céntimos** con funciones puras.

El carrito se reconcilia con el servidor: los productos inexistentes, inactivos o
agotados se retiran con un aviso, y las cantidades superiores al stock se ajustan.
El contador de cabecera suma unidades, no líneas. El checkout exige cuenta, pero
el carrito sigue siendo local: iniciar sesión no lo sincroniza con la base de datos.

### Checkout atómico e idempotente

Crear un pedido implica tres escrituras que deben ocurrir juntas: descontar stock,
crear `Order` y crear `OrderItem`. La operación se ejecuta dentro de una única
transacción de Prisma. Cada stock se descuenta con un `updateMany` condicional
(`active = true` y `stock >= cantidad`), ordenado por id de producto para reducir
bloqueos cruzados. Si otra compra se lleva la última unidad, la condición falla,
la transacción se revierte y no queda un pedido a medias.

El cliente genera una clave UUID por intento de compra. La tabla `orders` tiene una
restricción única `(userId, idempotencyKey)`: un doble clic, un reintento de red o
una respuesta perdida devuelven el pedido ya creado en lugar de duplicarlo. Si dos
peticiones compiten, solo una inserta; la otra captura la violación de unicidad y
consulta el pedido ganador.

El total y los precios unitarios se calculan en servidor a partir de los productos
actuales. `OrderItem.price` congela el precio del momento de la compra para que un
cambio posterior del catálogo no altere el histórico.

### Libro de stock y ajustes manuales

`Product.stock` no se edita directamente: es la suma de `StockMovement.variation`.
Cada venta, cancelación, reposición, ajuste o alta con stock genera un movimiento en
la misma transacción que cambia el stock. La migración de 6A dejó un `stock_inicial`
para cada producto con stock mayor que cero, incluidos los archivados.

Los ajustes manuales están limitados a `encargado` y `admin`, revalidados en servidor.
La reposición es positiva; el ajuste admite signo y exige nota; ambos rechazan cero,
valores no enteros y más de **10.000 unidades** por movimiento. La actualización usa
una condición atómica para no dejar stock negativo y el movimiento se guarda en la
misma transacción. La ficha del panel muestra los últimos 10 movimientos y enlaza al
pedido cuando existe.

Un pedido pendiente retiene el stock descontado hasta que se paga, se cancela o
caduca (48 h); no hay reserva al añadir al carrito.

### Taller: concurrencia y reglas en servidor

La unidad de trabajo es la propia `ServiceRequest`; fichajes, notas e historiales
cuelgan de ella. Una única función pura (`lib/service-status.ts`) decide qué cambio
de estado es válido para cada rol, y las acciones del taller se aplican con un
`updateMany` condicional sobre la reparación (responsable, estado esperado) que,
además, actualiza `lastActivityAt` y bloquea la fila frente a cambios simultáneos.

- **Un solo fichaje abierto por trabajador:** lo garantiza un índice único parcial
  sobre `work_logs(userId) WHERE endedAt IS NULL`; un check impide una salida anterior
  a la entrada. Un doble clic o dos dispositivos reciben «ya tienes un fichaje abierto».
- **Cierre automático:** todo estado distinto de `en_reparacion`, una reasignación o
  una devolución cierran el fichaje abierto en la misma transacción.
- **Tomar una reparación** es condicional: si otro la tomó antes, falla con un mensaje
  claro. Las devueltas solo las reasigna el encargado.
- **Avisos perezosos:** no hay cron. Las reparaciones sin actividad se calculan al
  cargar la página comparando `lastActivityAt` con `Config.inactiveRequestHours`.
- **Zona horaria:** los instantes se guardan en UTC y se muestran en Europe/Madrid;
  las semanas van de lunes a domingo en Madrid y un fichaje cuenta entero en la semana
  en la que empieza. Sin dependencias de fechas: `Intl` y tests con los cambios de hora.

### Gestión administrativa de pedidos

Las transiciones manuales viven en una única función pura: `pendiente → cancelado` y
`pagado → entregado | cancelado`. Un pedido solo pasa a `pagado` registrando su cobro
(manual o con la pasarela, Fase 4.0) y a `caducado` lo lleva el sistema a las 48 h sin
pago; `entregado`, `cancelado` y `caducado` son finales. Cada cambio
se aplica con `updateMany` condicional sobre el estado esperado, de modo que dos
pestañas o un doble clic no se pisan: la perdedora recibe un mensaje para recargar.

La cancelación lee las líneas dentro de la transacción y solo después de que la
actualización condicional haya cambiado una fila. Repone todas las líneas, incluidas
las de productos archivados, y crea un movimiento positivo `cancelacion_pedido` por
línea, ligado al pedido y al usuario. Una segunda cancelación no repone stock. Si el
pedido estaba pagado, se exige motivo; si se cobró con la pasarela, su sesión de pago
se reembolsa (simulado). Un cobro manual se devuelve fuera de la aplicación.

### Seguridad y permisos

- **Contraseñas** con `bcrypt` (coste 12). El registro público siempre asigna el rol `cliente`; Zod descarta cualquier `role` inyectado.
- **Middleware** en el edge para separar `/app` (cualquier sesión), `/admin` (solo `encargado` y `admin`) y `/trabajador` (`trabajador`, `encargado` y `admin`).
- **Revalidación del rol en cada Server Action** (`requerirStaff`, `requerirPersonalTaller`): el JWT no se considera prueba suficiente.
- **Propiedad de los datos**: las consultas del cliente filtran por `{ id, clientId }`; los pedidos filtran por `{ id, userId }`; el trabajador solo ve sus reparaciones y las aceptadas sin responsable (nunca devueltas), y sus fichajes y notas, con el filtro en la propia consulta. Un identificador ajeno devuelve 404, sin revelar si existe.
- **Privacidad del cliente en el taller**: el trabajador nunca recibe email ni teléfono del cliente, y de una reparación libre no recibe ni el nombre ni los historiales. El área de cliente nunca selecciona notas, fichajes ni historiales internos (fijado con tests).
- **Importes y estados** se validan en servidor; los formularios solo envían la intención (`aceptar`, `rechazar`) y el checkout nunca envía precios ni totales.
- **Callback seguro**: tras login o registro solo se acepta una ruta interna; se rechazan URLs externas, protocolos peligrosos y el acceso de un cliente al panel.

### Tests

La lógica sensible está aislada en funciones puras y cubierta con **Vitest**: reglas de importes, transiciones de estado, expiración, validaciones Zod y permisos básicos.

- **609 tests unitarios** en 70 archivos (`npm run test`, sin base de datos), incluidos validación, acciones, filtros del catálogo, carrito, cálculo de pedidos, conflictos de stock, idempotencia, edición sin stock, ajustes manuales, historial, transiciones de pedidos y de reparaciones, asignación, toma y devolución, visibilidad del panel del trabajador, fichaje, notas, avisos de inactividad, semanas y cambios de hora, reportes, límite de intentos de login, dirección de recogida, cobros, IVA y facturas, NIF, dashboard, CSV, plantillas y proveedores de email, pasarela simulada y fechas del seed. La capa de datos se prueba con Prisma mockeado.
- **106 tests de integración** (`npm run test:integration`) contra PostgreSQL real: índices únicos parciales y checks, filtros por relación en `updateMany`, cambio de hora en los reportes, límite de login, privacidad del cliente, checkout, caducidad, cobros, facturas (también las retroactivas frente a `lib/vat.ts`), dashboard, CSV, emails y pasarela. Los de concurrencia real (`*.concurrencia.int.test.ts`) usan conexiones separadas y limpian por prefijo. Usan una base aparte, `<base>_test`, derivada de `DATABASE_URL` (solo hosts locales); cada test va en una transacción que se revierte, y antes se aplican las migraciones con `prisma migrate deploy`. La base se crea una vez:

  ```bash
  docker compose exec db createdb -U postgres softhard_test
  ```
- TypeScript estricto y ESLint en cada cambio.
- **Integración continua** (`.github/workflows/ci.yml`, GitHub Actions): en cada push a `main` y en cada pull request ejecuta lint → tipos → tests unitarios → tests de integración → `prisma migrate deploy` → `npm run build`, contra un PostgreSQL 16 de usar y tirar en el propio runner (credenciales ficticias en el workflow, sin secretos ni despliegue). Una ejecución nueva cancela la anterior de la misma rama. Para que una PR no se pueda fusionar en rojo, protege `main` en GitHub (*Settings → Branches → Add rule*: *Require status checks to pass* con el check **Lint, tests y build**); es un ajuste del repositorio, no del código.

### Server Components y Server Actions

- **Server Components por defecto**; los componentes cliente se limitan a formularios e interacción.
- Las páginas no tocan Prisma: la capa `src/server/data` concentra consultas y control de propiedad.
- Las mutaciones son **Server Actions** con validación Zod y revalidación de rutas.
- Los formularios controlados usan `onSubmit` + `useTransition` para evitar el reset de formularios de React 19 y conservar lo escrito ante errores.

## Roadmap

### Fase 1 — completada

- [x] Landing pública con servicios y contacto.
- [x] Registro, login y logout con Auth.js.
- [x] Rutas `/app` y `/admin` protegidas por rol en servidor.
- [x] Solicitudes de servicio con validación Zod.
- [x] Listado y detalle de solicitudes del cliente.
- [x] Panel del encargado con filtros por estado.
- [x] Presupuestos con la regla del descuento.
- [x] Aceptación, rechazo y expiración del presupuesto.
- [x] Tests de la lógica de negocio.
- [x] README con instrucciones.

### Fase 2 — completada

- [x] Modelo `Product` y migración.
- [x] CRUD interno de productos en `/admin/productos`.
- [x] Productos demo en el seed y tests de validación/acciones.
- [x] Catálogo público con filtros por categoría y estados de stock.
- [x] Fichas públicas de producto.
- [x] Carrito local con contador, cantidades, total y revalidación de precios/stock.
- [x] Checkout autenticado, pedidos, descuento atómico de stock e idempotencia.
- [x] Historial y detalle de pedidos del cliente.
- [x] Libro de stock, ajustes manuales e historial por producto.
- [x] Gestión administrativa de pedidos, transiciones y cancelación con reposición.

### Fase 3 — completada

- [x] 3.1 Datos y permisos del taller.
- [x] 3.2a Máquina de transiciones de estado con historial.
- [x] 3.2b Asignación, toma y devolución con historial.
- [x] 3.3 Panel del trabajador: mis reparaciones, detalle y reparaciones por tomar.
- [x] 3.4 Fichaje con historial semanal, cierre y corrección del encargado.
- [x] 3.5 Notas y falta de repuesto con atención del encargado.
- [x] 3.6 Avisos de reparaciones sin actividad y devueltas sin responsable.
- [x] 3.7 Vistas y reportes del encargado.

### Deuda técnica — completada

- [x] D1 Límite de intentos fallidos de inicio de sesión (5 por email y 20 por IP en 15 minutos).
- [x] D2 Todos los formularios con `onSubmit` + `useTransition`: no se pierde lo escrito ante un error.
- [x] D3 Dirección de recogida en las visitas a domicilio.
- [x] D4 Tests de integración contra PostgreSQL real.
- [x] D5 El panel de fichajes conserva semana y trabajador tras cerrar o corregir.
- [x] Capturas del área del taller en el README.

### Deuda previa a la Fase 4 — completada

- [x] Caducidad de pedidos pendientes (48 h) con estado `caducado` y liberación de stock.
- [x] Tests de integración del checkout y del pedido, con concurrencia real.

### Fase 4 — completada

- [x] 4.0 Registro de cobros unificado en pedidos y reparaciones.
- [x] 4.3 Facturación simulada: FAC, RECT, re-emisión y retroactivas MIG.
- [x] Seed histórico de 12 meses.
- [x] 4.1 Dashboard de ingresos por factura.
- [x] 4.2 Exportación a CSV.

### Fase 5 — completada

- [x] 5.1 CI con GitHub Actions.
- [x] 5.2 Emails transaccionales con outbox, worker y Mailpit.
- [x] 5.3 Pasarela de pago simulada con reembolsos.
- 🚧 Prueba manual del envío a un Mailpit real (ver [trabajo futuro](#estado-del-proyecto-y-trabajo-futuro)).

## Estado del proyecto y trabajo futuro

La versión actual está **terminada**: las cinco fases funcionan de principio a fin, con tests, CI y documentación. Cubre la parte **operativa** de un servicio técnico con tienda: atención al cliente, presupuestos, taller, tienda, stock, cobros, facturación simulada, ingresos y comunicaciones.

Una empresa real necesita además otras áreas que forman, junto a esta, una unidad completa: personas (recursos humanos), compras y proveedores, contabilidad, cumplimiento legal y la puesta en producción. Quedaron fuera a propósito para que el proyecto tuviera un alcance que se pudiera terminar, probar y documentar bien. Cada una se ha dejado apuntada con su motivo y, cuando existe, con el punto del código desde el que se continuaría.

**Leyenda:** **🚧 En construcción**: empezado en el código o en los datos, sin terminar ni activar. **🔭 Futuro**: planificado, sin empezar.

### 🚧 En construcción

| Qué | Qué hay hoy | Qué falta | Por qué no se ha cerrado |
|---|---|---|---|
| Verificación de emails con Mailpit | Outbox, worker, reintentos y panel `/admin/emails`, con tests de integración y un proveedor simulado. Servicio `mailpit` en `docker-compose.yml`. | Comprobar a mano que llegan a un Mailpit real. | Es una comprobación manual pendiente; el código no depende de ella y está cubierto por tests de integración. |
| Envío real de emails (Resend) | Proveedor `resend` escrito en `src/server/providers/email.ts`, desactivado. | Dominio verificado, clave de API y pruebas con envíos reales. | Exige una cuenta y un dominio propios, y enviar emails a personas reales no tiene sentido con datos ficticios. |
| Pagos reales (Stripe) | Pasarela simulada (`mock`) completa, con sesiones, idempotencia y reembolsos. El nombre `stripe` está reservado en `src/server/providers/payments.ts`. | Checkout Session de Stripe, webhook firmado y conciliación. | Cobrar dinero real queda fuera de un proyecto con datos ficticios. La pasarela simulada ya demuestra el diseño. |
| Pago por adelantado del diagnóstico | La opción `requireDiagnosticPaymentUpfront` existe en la configuración. | Pedir el pago del diagnóstico antes de aceptar la solicitud. | Cambia el flujo de alta de solicitudes; se dejó solo modelado para no romper el flujo ya probado. |
| Historial de correcciones de fichajes | Al corregir un fichaje se guarda quién y cuándo hizo la última corrección. | Historial completo de cambios y aviso de solapes entre fichajes corregidos. | Es una mejora de auditoría; el fichaje funciona y se puede corregir. |

### 🔭 Futuro

| Área | Qué incluiría | Por qué no está en esta versión |
|---|---|---|
| **Recursos humanos** | Ficha de empleado, contratos, turnos y calendario, vacaciones y ausencias, aprobación de horas, pausas y nóminas, a partir de los fichajes que ya existen. | Es un módulo entero con datos personales sensibles (RGPD) y normativa laboral; hoy los trabajadores son solo usuarios con rol `trabajador`. |
| **Compras y proveedores** | Proveedores, pedidos de compra, recepción de mercancía y reposición automática de stock. | Hoy la reposición es un ajuste manual del libro de stock. Necesita su propio modelo de datos. |
| **Inventario de repuestos** | Piezas usadas en cada reparación, con coste y stock propio. | La falta de repuesto se avisa con una nota; descontar piezas exige enlazar taller, stock y compras. |
| **Contabilidad** | Libro diario, gastos, impuestos trimestrales y conciliación bancaria. | Las facturas e ingresos ya existen; la contabilidad completa es un dominio propio, normalmente un programa aparte. |
| **Facturación con validez fiscal** | Verifactu o TicketBAI, SII, firma y código QR. | Depende de normativa y servicios de la Agencia Tributaria; las facturas actuales son simuladas y lo indican. |
| **Atención al cliente** | Tickets o chat, valoraciones y garantías de las reparaciones. | El seguimiento se hace hoy con los estados de la solicitud y las notas internas. |
| **Tienda ampliada** | Envíos y transportistas, cupones, reserva de stock en el carrito, sincronización del carrito con la cuenta, historial de estados del pedido y recomendaciones. | La tienda cubre el ciclo de compra completo con recogida; estas mejoras amplían el comercio electrónico, no el núcleo. |
| **Notificaciones** | Notificaciones push y más emails (recordatorios, encuestas). | Los tres emails transaccionales cubren los momentos clave del flujo. |
| **Despliegue en producción** | Servidor o plataforma, base de datos gestionada, dominio, HTTPS, copias de seguridad y monitorización. | El proyecto se ejecuta en local y con CI; publicarlo implica costes y datos reales, fuera del objetivo de portafolio. |

## Documentación

- [`docs/specs/fase-1.md`](docs/specs/fase-1.md) — objetivos, historias de usuario y criterios de aceptación de la Fase 1.
- [`docs/specs/fase-2.md`](docs/specs/fase-2.md) — alcance del catálogo, el carrito, el checkout y criterios de la Fase 2.
- [`docs/specs/fase-3.md`](docs/specs/fase-3.md) — taller interno: estados, asignación, fichaje, notas, avisos, vistas, sub-fases y criterios de la Fase 3.
- [`docs/specs/deuda-fase4.md`](docs/specs/deuda-fase4.md) — caducidad de pedidos pendientes y tests de integración del checkout.
- [`docs/specs/fase-4.md`](docs/specs/fase-4.md) — cobros, facturación simulada, seed histórico, dashboard de ingresos y exportación a CSV.
- [`docs/specs/fase-5.md`](docs/specs/fase-5.md) — CI, emails transaccionales con outbox y pasarela de pago simulada.
- [`AGENTS.md`](AGENTS.md) — convenciones y reglas de trabajo del repositorio.
- [`memory.md`](memory.md) — estado y notas de continuidad del proyecto.

---

Proyecto de portafolio de **Alexander Nevado**. Todos los datos son ficticios y no se realiza ningún cobro real.
