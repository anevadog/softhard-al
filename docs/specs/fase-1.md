# Spec Fase 1 — SoftHard A&L

## Objetivo
MVP público + autenticación con roles + solicitud de servicio + panel mínimo del encargado.
Sin pagos reales. Sin e-commerce. Sin tickets internos.

## Actores
- Visitante: ve landing y servicios. Puede registrarse.
- Cliente: solicita servicio, ve estado de sus solicitudes.
- Encargado: ve todas las solicitudes, cambia estado, asigna trabajador.
- Trabajador: (Fase 1) solo login y perfil. Sin ficha de taller todavía.
- Admin: igual que encargado en Fase 1.

## Historias de usuario
1. Como visitante quiero ver quiénes somos, servicios y contacto.
2. Como visitante quiero registrarme como cliente.
3. Como usuario quiero iniciar y cerrar sesión.
4. Como cliente quiero solicitar un servicio indicando tipo de equipo, marca, modelo, problema, modalidad (domicilio/taller) y franja horaria.
5. Como cliente quiero ver mis solicitudes y su estado.
6. Como cliente quiero ver el importe estimado y si acepto o no el presupuesto, aplicando la regla del descuento.
7. Como encargado quiero ver todas las solicitudes entrantes y cambiar su estado.

## Regla del descuento (X = tarifa diagnóstico, configurable)
- Solicitud creada → estado `pendiente`.
- Encargado diagnostica → crea presupuesto con importe y X aplicada.
- Cliente acepta → importe final = presupuesto - X. Estado `aceptada`.
- Cliente rechaza → importe final = X. Estado `rechazada`.
- Si no responde en N días → `expirada` (N configurable, por defecto 7).

## Estados de ServiceRequest
`pendiente` → `diagnosticada` → `aceptada` | `rechazada` | `expirada` → `en_reparacion` ⇄ `esperando_repuesto`; `en_reparacion` → `lista` → `entregada`.

`esperando_repuesto` lo incorpora la Fase 3 (ver `docs/specs/fase-3.md`): una reparación
pasa de `en_reparacion` a `esperando_repuesto` y vuelve cuando llega la pieza.

Fase 1 solo implementa hasta `aceptada`/`rechazada`. El resto queda para Fase 3.

## Criterios de aceptación Fase 1
- [x] Landing pública con secciones: hero, servicios, cómo funciona, contacto.
- [x] Registro de cliente con email único y contraseña hasheada.
- [x] Login/logout funcional.
- [x] Rutas `/app/*` y `/admin/*` protegidas en servidor por rol.
- [x] Cliente puede crear solicitud con validación Zod.
- [x] Cliente ve listado y detalle de sus solicitudes.
- [x] Encargado ve todas y puede cambiar estado.
- [x] Cliente puede aceptar o rechazar presupuesto; se calcula importe final.
- [x] Tests: al menos auth (registro/login) y creación de solicitud.
- [x] README con instrucciones y capturas.

## Fuera de alcance Fase 1
- Carrito, productos, pedidos.
- Tickets internos.
- Fichaje de horas.
- Contabilidad.
- Pagos reales.
- Emails automáticos.