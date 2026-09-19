# sprint-3-auth-and-account-migration · undefined — Diseño

## Scope (archivos que puede tocar)

- `apps/web/src/app/(auth)/**`
- `apps/web/src/app/auth/**`
- `apps/web/src/app/login/**`
- `apps/web/src/lib/supabase/**`
- `apps/web/src/proxy.ts`
- `supabase/**`
- `scripts/migration/auth/**`
- `tests/**`
- `docs/**`
- `.env.example`
- `spec.json`

## Enfoque

- **data_model:** `auth.users` es la identidad; `profiles.user_id` y `legacy_id_map` enlazan datos y Firebase UID sin usar email como clave.
- **external_contracts:** Supabase Auth SSR usa PKCE/cookies; el import consume el formato oficial de Firebase Auth detrás de un adaptador y dry-run.
- **edge_cases:** El import es idempotente por Firebase UID, preserva verificación/disabled y deriva a reset cuando la contraseña no puede conservarse.
- **ui_states:** Login, signup, verificación pendiente, solicitud/confirmación de reset, callback fallido, logout y cuenta deshabilitada tienen estados accesibles y neutrales.

