# sprint-12-firebase-data-migration-and-reconciliation · undefined — Diseño

## Scope (archivos que puede tocar)

- `scripts/migration/**`
- `supabase/**`
- `tests/migration/**`
- `docs/migration/**`
- `.env.example`
- `spec.json`

## Enfoque

- **data_model:** Snapshot JSONL inmutable por colección, ruta completa y checksum; legacy_id_map enlaza UID y documentos con UUID target estable.
- **external_contracts:** Comandos capture, plan, dry-run, import y reconcile; origen Firestore exacto what-s-in-my-fridge-a2a07 y destino local/staging.
- **edge_cases:** Rerun, cambio de documento, checkpoint incompatible y drift durante captura tienen resultados deterministas; datos locales WatermelonDB sin export se declaran cobertura parcial.
- **ui_states:** No hay UI en este sprint; estados operativos running, completed, partial y failed en reportes.

## Decisiones de la entrevista

- **data_model:** Acceso directo a Firestore; proyecto what-s-in-my-fridge-a2a07.
- **edge_cases:** No hay export de datos exclusivos de WatermelonDB; declarar cobertura parcial.

