# Memoria del proyecto — SoftHard A&L

Máximo 50 líneas. Actualizar al terminar cada tarea. Resume o elimina lo que ya no aporte.

## Estado actual
- Fase 1 en curso: landing, auth con roles, solicitud de servicio, panel encargado mínimo.
- Repo privado, uso portfolio.

## Decisiones tomadas
- Stack: Next.js 15 + TS + Tailwind + Prisma + PostgreSQL + Auth.js v5 (JWT).
- Roles: cliente, trabajador, encargado, admin.
- Regla descuento: X = tarifa diagnóstico. Acepta reparación → total = presupuesto - X. Rechaza → se cobra X.
- Pagos simulados en Fase 1 (sin pasarela real).
- Datos ficticios en demo. Sin datos reales de clientes.

## Próximos pasos
- [ ] Scaffold Next.js + Tailwind + Prisma
- [ ] Docker compose Postgres
- [ ] Esquema Prisma Fase 1
- [ ] Auth.js + registro/login + roles
- [ ] Middleware de protección de rutas
- [ ] Landing pública
- [ ] Formulario solicitud de servicio
- [ ] Área cliente: listar solicitudes
- [ ] Panel encargado: ver y cambiar estado
- [ ] Tests mínimos (auth + solicitud)
- [ ] README + capturas

## Aprendizajes / notas
- Auth.js v5 con credentials obliga a estrategia JWT (no database sessions) con Prisma adapter.