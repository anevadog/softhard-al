@AGENTS.md
@memory.md

## Claude Code
- Antes de planificar una tarea, lee su spec (no están importadas para ahorrar
  contexto): Fase 3 → docs/specs/fase-3.md; deuda previa a la Fase 4 →
  docs/specs/deuda-fase4.md; Fase 4 → docs/specs/fase-4.md; Fase 5 →
  docs/specs/fase-5.md. Orden acordado: deuda → Fase 4 (4.0 → 4.3 → 4.1 → 4.2)
  → Fase 5; todo completado. Lo pendiente está en el README ("Estado del proyecto
  y trabajo futuro"). Los cobros (pedidos y reparaciones) se registran en la propia
  entidad desde 4.0 (`paidAt`, `paidAmount`…) y emiten la factura. Los ingresos
  se calculan sobre `Invoice.total` por `issuedAt` (rectificativas en negativo);
  `paidAt` es solo flujo de caja y auditoría.
- Antes de usar la base de datos, comprueba que DATABASE_URL apunta a localhost y
  dímelo.
- Migraciones: genéralas con --create-only, enséñame el SQL antes de aplicarlas y
  aplícalas con prisma migrate deploy. Nunca modifiques migraciones antiguas.
- Si un comando pide reiniciar o borrar la base de datos, para y avísame.
- El usuario trabaja con Git Bash en Windows: usa `npm` y `npx` normales, no `.cmd`.