# Implementación · Sprint 1

## Completado

- Configuración Supabase local versionada y migración inicial para `profiles`, `legacy_id_map` y `migration_runs`.
- RLS CRUD por `auth.uid()` para todas las tablas privadas y policies por carpeta UUID para Storage.
- Buckets privados `receipts-temp` y `user-assets` con límites de MIME/tamaño.
- Clientes browser/server/admin separados, cookies SSR, PKCE, callback y ruta privada.
- Tipos de base consumidos por el build, controles de secretos y documentación de entornos.
- Suite pgTAP con dos usuarios para tablas y Storage.

## Gates ejecutados

- `pnpm typecheck`: OK
- `pnpm lint`: OK
- `pnpm test`: 3 tests OK
- `pnpm test:e2e`: 1 smoke móvil OK
- `pnpm build`: OK
- `pnpm check:boundaries`, `check:env`, `check:supabase`: OK

## Pendiente verificable

Docker ya está disponible. `supabase start`, `supabase db reset --no-seed`, `pnpm db:lint` y las 24 aserciones de `pnpm test:rls` pasan. Los tipos se regeneraron desde PostgreSQL local y typecheck, lint, tests unitarios y build vuelven a pasar.

Pendiente antes de `review_pending`: prueba de aislamiento mediante Storage API (incluido borrado), sesión privada end-to-end y comprobación de drift de tipos contra el esquema. La aserción de borrado SQL verifica el rechazo global de Storage, no sustituye el test de autorización vía API.

## Despliegue staging · 2026-09-18

Con autorización explícita del usuario, se enlazó el proyecto `bwscshjtwmsfscbjbndq` (What's In My Fridge, Ireland), se verificó el dry-run y se aplicó únicamente `20260918000100_platform_foundation.sql`, sin seeds ni datos de usuario. `db lint --linked` pasa sin errores y el historial remoto coincide con la migración local. No se han configurado aún Auth URLs ni la conexión web de staging.
