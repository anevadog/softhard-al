# SoftHard A&L

**Web de servicios técnicos y venta de productos de informática.** Reparación de ordenadores, portátiles e impresoras, con solicitud online, presupuesto y seguimiento desde el área de cliente.

Proyecto de portafolio de **Alexander Nevado**. Los usuarios, solicitudes, importes y marcas que aparecen en la aplicación son **datos ficticios**: no hay clientes ni pagos reales.

`Fase 1 completada` · `Fase 2 en curso` · `Next.js 15` · `TypeScript` · `PostgreSQL` · `119 tests`

## Capturas

**Landing pública**

![Landing de SoftHard A&L con los servicios, el proceso de reparación y el contacto](docs/capturas/landing.png)

**Panel del encargado**

![Panel interno con el listado de solicitudes y los filtros por estado](docs/capturas/panel-encargado.png)

**Detalle de la solicitud**

![Detalle de una solicitud con el presupuesto y los botones para aceptar o rechazar](docs/capturas/detalle-solicitud.png)

## Índice

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
- [Fuera de alcance](#fuera-de-alcance)
- [Documentación](#documentación)

## Qué es

SoftHard A&L es una aplicación full stack que cubre el ciclo completo de una reparación:

1. El visitante conoce el taller y sus servicios.
2. El cliente se registra y crea una solicitud indicando equipo, avería, modalidad y franja horaria.
3. El encargado revisa la solicitud, emite un presupuesto y gestiona su estado.
4. El cliente acepta o rechaza el presupuesto dentro del plazo y ve el importe final que le corresponde.

La Fase 2 ya está en marcha: empieza por el catálogo interno de productos. La tienda pública, el carrito y los pedidos llegan en las siguientes tareas.

## Funcionalidad

### Fase 1: servicio técnico

#### Público

- Landing con hero, servicios, cómo funciona y contacto.
- Registro de nuevos clientes con email único y contraseña hasheada.

#### Cliente

- Inicio y cierre de sesión.
- Creación de solicitudes con validación en servidor: tipo de equipo, marca, modelo, problema, modalidad (domicilio o taller) y franja horaria.
- Listado de sus propias solicitudes y página de detalle.
- Visualización del presupuesto: importe, tarifa de diagnóstico e importe final.
- Aceptación o rechazo del presupuesto, con expiración automática a los 7 días.

#### Encargado / administrador

- Panel con todas las solicitudes y filtro por estado con contadores.
- Detalle de cada solicitud con datos del cliente, equipo y problema.
- Creación del presupuesto con vista previa del importe final.
- Cambio manual de estado entre los 8 estados del flujo.

### Fase 2 (en curso)

- Catálogo interno en `/admin/productos` con listado, precio, stock y categoría.
- Creación y edición de productos con validación Zod en servidor.
- Borrado lógico: el producto se archiva y deja de mostrarse en el catálogo.
- Solo `encargado` y `admin` acceden al panel; `cliente` y `trabajador` son redirigidos.
- Cinco productos de demostración creados por el seed.

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

### Requisitos

- **Node.js 24** (la versión exacta está en `.nvmrc`) y npm.
- **Docker** (recomendado) o un **PostgreSQL 16** local.
- Git.

### Paso a paso

```bash
# 1. Clona el repositorio (privado: solicita acceso)
git clone <url-del-repositorio>
cd softhard-al

# 2. Instala las dependencias
npm install

# 3. Crea el archivo de entorno a partir del ejemplo
cp .env.example .env
```

Edita `.env` y genera un secreto para `AUTH_SECRET`:

```bash
# Git Bash, WSL o macOS/Linux
openssl rand -base64 32
```

En Windows sin OpenSSL, usa Git Bash/WSL o cualquier generador de secretos de al menos 32 bytes.

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `AUTH_SECRET` | Secreto con el que se firman los JWT |
| `AUTH_URL` | URL base de la aplicación (`http://localhost:3000`) |
| `NEXTAUTH_URL` | Compatibilidad con Auth.js v4; mismo valor que `AUTH_URL` |

```bash
# 4. Levanta PostgreSQL con Docker
docker compose up -d
```

Si prefieres un PostgreSQL local, crea la base de datos y ajusta `DATABASE_URL`:

```bash
createdb softhard
```

```bash
# 5. Aplica migraciones y genera el cliente de Prisma
npx prisma migrate dev

# 6. Carga la configuración, los usuarios y los productos de demostración
npx prisma db seed

# 7. Arranca el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> `src/generated/` está excluido del repositorio. Si el cliente de Prisma no existe tras el clone, ejecuta `npx prisma generate`.

### Producción

```bash
npm run build
npm run start
```

### Problemas frecuentes

- **El puerto 5432 está ocupado:** cambia el mapeo en `docker-compose.yml` (por ejemplo `5433:5432`) y actualiza `DATABASE_URL`.
- **Error de cliente Prisma no inicializado:** ejecuta `npx prisma generate`.
- **Falta `AUTH_SECRET`:** genera uno nuevo y reinicia el servidor.

## Usuarios de prueba

El seed es idempotente y crea cuatro cuentas con la misma contraseña: **`Demo1234!`**

| Email | Rol | Acceso |
|---|---|---|
| `cliente@demo.local` | cliente | `/app` |
| `trabajador@demo.local` | trabajador | `/app` (sin acceso al panel) |
| `encargado@demo.local` | encargado | `/admin` (solicitudes y productos) |
| `admin@demo.local` | admin | `/admin` (solicitudes y productos) |

En la Fase 1, `admin` y `encargado` comparten permisos. El seed también crea la configuración de negocio (**30 €** de tarifa de diagnóstico y **7 días** de validez del presupuesto) y cinco productos de demostración para el catálogo.

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

Comandos de base de datos:

```bash
npx prisma migrate dev   # aplica migraciones en desarrollo
npx prisma db seed       # carga configuración, usuarios y productos demo
npx prisma studio        # explora la base de datos
```

## Estructura del proyecto

```text
src/
  app/
    (public)/              landing pública
    (auth)/                login y registro
    app/                   área del cliente
    admin/                 panel interno
    api/auth/              handler de Auth.js
  components/
    site/                  secciones de la landing
    service-requests/      solicitudes, presupuestos y decisión
    admin/                 solicitudes y CRUD de productos
  lib/
    auth.ts, authz.ts      autenticación y permisos
    quotes.ts              reglas puras de importes y expiración
    products.ts            categorías y tipos del catálogo
    validations/           esquemas Zod
  server/
    actions/               Server Actions (mutaciones)
    data/                  acceso a datos con control de propiedad
prisma/
  schema.prisma
  migrations/
  seed.ts
public/productos/          placeholder de producto
docs/specs/               especificaciones de Fase 1 y Fase 2
```

## Decisiones de arquitectura

### Regla del descuento

La tarifa de diagnóstico **X** y los días de validez **N** viven en la tabla `Config`. Al crear un presupuesto, **X se copia** en el propio presupuesto para que un cambio futuro de tarifa no altere documentos ya emitidos.

- **Aceptar:** el importe final es `presupuesto − X`.
- **Rechazar:** el importe final es `X` (solo se abona el diagnóstico).
- **Expirar:** si pasan **N** días sin respuesta, el presupuesto caduca y ya no admite decisión.

Los importes se calculan en **céntimos** con funciones puras y se persisten como `Decimal(10,2)`, evitando la deriva de la coma flotante. El servidor recalcula siempre el importe: nunca acepta cantidades del formulario.

La expiración es **perezosa**: no hay cron. Al leer una solicitud se comprueba `expiresAt` y, si corresponde, se actualizan el presupuesto a `expirado` y la solicitud a `expirada` de forma idempotente.

### Seguridad y permisos

- **Contraseñas** con `bcrypt` (coste 12). El registro público siempre asigna el rol `cliente`; Zod descarta cualquier `role` inyectado.
- **Middleware** en el edge para separar `/app` (cualquier sesión) de `/admin` (solo `encargado` y `admin`).
- **Revalidación del rol en cada Server Action** (`requerirStaff`): el JWT no se considera prueba suficiente.
- **Propiedad de los datos**: las consultas del cliente filtran por `{ id, clientId }`. Un identificador ajeno devuelve 404, sin revelar si existe.
- **Importes y estados** se validan en servidor; los formularios solo envían la intención (`aceptar`, `rechazar`).

### Tests

La lógica sensible está aislada en funciones puras y cubierta con **Vitest**: reglas de importes, transiciones de estado, expiración, validaciones Zod y permisos básicos.

- **119 tests** en 12 archivos (`npm run test`), incluidos los de validación y acciones del catálogo.
- TypeScript estricto y ESLint en cada cambio.
- Pendiente como deuda: tests de integración con base de datos y de los flujos completos de permisos.

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

### Fase 2 — en curso

- [x] Modelo `Product` y migración.
- [x] CRUD interno de productos en `/admin/productos`.
- [x] Productos demo en el seed y tests de validación/acciones.
- [ ] Catálogo público y fichas de producto.
- [ ] Carrito y realización de pedidos.
- [ ] Gestión básica de stock.
- [ ] Integración del catálogo con el área de cliente.

### Fase 3 — futuro

- Operativa completa de taller: asignación de trabajadores, reparación y entrega.
- Historial de estados y notificaciones por email.
- Pagos reales y facturación.

## Fuera de alcance

Estas funciones quedan fuera del alcance actual (Fase 1 y catálogo interno de la Fase 2):

- Pagos reales y pasarela de pago.
- E-commerce completo (carrito, pedidos y stock automático).
- Tickets internos y fichaje de horas.
- Contabilidad y facturación.
- Emails automáticos y notificaciones.
- Rate limiting en el login (deuda técnica anotada).

## Documentación

- [`docs/specs/fase-1.md`](docs/specs/fase-1.md) — objetivos, historias de usuario y criterios de aceptación de la Fase 1.
- [`docs/specs/fase-2.md`](docs/specs/fase-2.md) — alcance del catálogo y criterios de la Fase 2.
- [`AGENTS.md`](AGENTS.md) — convenciones y reglas de trabajo del repositorio.
- [`memory.md`](memory.md) — estado y notas de continuidad del proyecto.

---

Proyecto de portafolio de **Alexander Nevado**. Todos los datos son ficticios y no se realiza ningún cobro real.
