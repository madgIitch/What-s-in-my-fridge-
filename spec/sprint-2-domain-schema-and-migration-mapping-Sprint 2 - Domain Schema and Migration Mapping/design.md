# sprint-2-domain-schema-and-migration-mapping · undefined — Diseño

## Scope (archivos que puede tocar)

- `supabase/migrations/**`
- `supabase/seed.sql`
- `packages/domain/**`
- `scripts/migration/**`
- `tests/**`
- `docs/**`
- `spec.json`

## Enfoque

- **data_model:** Tablas autoritativas normalizadas para inventario, borradores OCR, favoritos, comidas, mappings verificados y catálogo; UUID de cliente estable, ownership explícito y trazabilidad legacy única.
- **external_contracts:** PostgreSQL/Supabase migrations y tipos de dominio son el contrato canónico; Firebase/WatermelonDB solo aportan IDs y campos legacy para el mapping.
- **edge_cases:** Se preservan snapshots históricos, receta opcional frente a custom name, valores nullable, tombstones y reimportación del mismo documento sin duplicados.
- **ui_states:** Este sprint no crea UI; el modelo conserva confirmed, deleted_at y timestamps suficientes para que sprints posteriores representen borrador, sincronización y eliminación.

