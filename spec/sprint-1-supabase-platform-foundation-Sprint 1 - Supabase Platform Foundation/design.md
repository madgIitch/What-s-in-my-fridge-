# sprint-1-supabase-platform-foundation · undefined — Diseño

## Scope (archivos que puede tocar)

- `apps/web/**`
- `supabase/**`
- `packages/**`
- `tests/**`
- `.github/workflows/**` (ampliación aprobada por el usuario para CI/CD de migraciones)
- `.env.example`
- `docs/**`
- `spec.json`

## Enfoque

CI/CD: cada PR reconstruye Supabase local, ejecuta lint/RLS y comprueba drift de tipos. Un push a main despliega solo a staging `bwscshjtwmsfscbjbndq` después de web y database verdes. Producción queda fuera; no se ejecutan seeds remotos. Secrets en GitHub Environment staging y despliegues serializados sin cancelar migraciones en curso.

- **data_model:** UUIDs alineados con auth.users; profiles 1:1, legacy_id_map con identidad de origen única y migration_runs auditables sin secretos.
- **external_contracts:** Supabase CLI/migrations son la fuente reproducible; SSR usa cookies y PKCE mediante @supabase/ssr.
- **edge_cases:** conflictos de legacy IDs, paths de Storage ajenos y sesiones caducadas quedan cubiertos por constraints/policies.
- **ui_states:** ruta privada mínima con estado autenticado y redirección estable a /login si falta sesión.
