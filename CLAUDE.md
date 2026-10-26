@AGENTS.md
@memory.md

## Claude Code
- Para tareas de la Fase 3, lee docs/specs/fase-3.md antes de planificar (no está
  importado para ahorrar contexto).
- Antes de usar la base de datos, comprueba que DATABASE_URL apunta a localhost y
  dímelo.
- Migraciones: genéralas con --create-only, enséñame el SQL antes de aplicarlas y
  aplícalas con prisma migrate deploy. Nunca modifiques migraciones antiguas.
- Si un comando pide reiniciar o borrar la base de datos, para y avísame.