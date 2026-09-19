# Arquitectura

> El agente lo lee antes de implementar. Mantén aquí el contexto que no cabe en una feature concreta.

## Visión general

Producto/proyecto: Neverita / What's In My Fridge, migración progresiva del cliente Expo a una PWA.

Usuarios principales: personas que gestionan inventario doméstico, recetas, compras y comidas desde el móvil.

Objetivo no negociable: preservar los contratos funcionales y los datos del producto durante una migración reversible.

## Componentes

- Cliente móvil legado (`App.tsx`, `src/`): producto React Native/Expo actual; permanece intacto hasta el cutover.
- PWA (`apps/web`): interfaz Next.js App Router mobile-first, desplegable en Vercel.
- Dominio (`packages/domain`): contratos TypeScript sin dependencias de UI o infraestructura.
- Backend legado (`whats-in-my-fridge-backend`): Firebase Functions y workers actuales; referencia funcional durante la migración.
- Migración (`scripts/migration`): importadores idempotentes y herramientas de reconciliación futuras.

## Flujo de datos

1. Durante Sprint 0 la PWA renderiza una shell estática y no conecta con producción.
2. Los siguientes verticales moverán estado de Firebase/WatermelonDB a Supabase e IndexedDB bajo specs independientes.
3. El procesamiento pesado se encolará desde Vercel y se ejecutará en Cloud Run.

## Integraciones externas

- Vercel: sirve Next.js y la lógica interactiva Node; nunca procesa vídeo pesado.
- Supabase: será fuente de verdad para Postgres, Auth, Storage y Realtime.
- Google Cloud: Vision para OCR y Cloud Tasks/Cloud Run para media e IA.
- Stripe: checkout, portal y webhooks; secretos solo en servidor.

## Restricciones conocidas

- No se elimina ni modifica destructivamente el stack legado antes de reconciliación y rollback aprobado.
- Ningún secreto usa prefijo `NEXT_PUBLIC_`.
- La shell web se puede compilar y previsualizar sin credenciales ni acceso a producción.

## Decisiones abiertas

- Cada decisión de datos, autenticación u offline se resolverá en su sprint aprobado; Sprint 0 no anticipa esos contratos.

<!-- Los specs aprobados se anexan debajo con marcadores harness:<id>. -->

<!-- harness:sprint-0-pwa-migration-foundation -->
## sprint-0-pwa-migration-foundation · Sprint 0 - PWA Migration Foundation



### Scope aprobado

  - `apps/web/**`
  - `packages/**`
  - `scripts/migration/**`
  - `.github/workflows/**`
  - `.gitattributes`
  - `.env.example`
  - `docs/**`
  - `spec.json`

<!-- harness:sprint-1-supabase-platform-foundation -->
## sprint-1-supabase-platform-foundation · Sprint 1 - Supabase Platform Foundation



### Scope aprobado

  - `apps/web/**`
  - `supabase/**`
  - `packages/**`
  - `tests/**`
  - `.env.example`
  - `docs/**`
  - `spec.json`

### Contexto técnico

- **data_model:** UUIDs alineados con auth.users; profiles 1:1, legacy_id_map con identidad de origen única y migration_runs auditables sin secretos.
- **external_contracts:** Supabase CLI/migrations son la fuente reproducible; SSR usa cookies y PKCE mediante @supabase/ssr.
- **edge_cases:** conflictos de legacy IDs, paths de Storage ajenos y sesiones caducadas quedan cubiertos por constraints/policies.
- **ui_states:** ruta privada mínima con estado autenticado y redirección estable a /login si falta sesión.

<!-- harness:sprint-2-domain-schema-and-migration-mapping -->
## sprint-2-domain-schema-and-migration-mapping · Sprint 2 - Domain Schema and Migration Mapping



### Scope aprobado

  - `supabase/migrations/**`
  - `supabase/seed.sql`
  - `packages/domain/**`
  - `scripts/migration/**`
  - `tests/**`
  - `docs/**`
  - `spec.json`

### Contexto técnico

- **data_model:** Tablas autoritativas normalizadas para inventario, borradores OCR, favoritos, comidas, mappings verificados y catálogo; UUID de cliente estable, ownership explícito y trazabilidad legacy única.
- **external_contracts:** PostgreSQL/Supabase migrations y tipos de dominio son el contrato canónico; Firebase/WatermelonDB solo aportan IDs y campos legacy para el mapping.
- **edge_cases:** Se preservan snapshots históricos, receta opcional frente a custom name, valores nullable, tombstones y reimportación del mismo documento sin duplicados.
- **ui_states:** Este sprint no crea UI; el modelo conserva confirmed, deleted_at y timestamps suficientes para que sprints posteriores representen borrador, sincronización y eliminación.

<!-- harness:sprint-3-auth-and-account-migration -->
## sprint-3-auth-and-account-migration · Sprint 3 - Supabase Auth and Account Migration



### Scope aprobado

  - `apps/web/src/app/(auth)/**`
  - `apps/web/src/app/auth/**`
  - `apps/web/src/app/login/**`
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/app/globals.css`
  - `apps/web/src/lib/supabase/**`
  - `apps/web/src/proxy.ts`
  - `supabase/**`
  - `scripts/migration/auth/**`
  - `tests/**`
  - `docs/**`
  - `.env.example`
  - `spec.json`

### Contexto técnico

- **data_model:** `auth.users` es la identidad; `profiles.user_id` y `legacy_id_map` enlazan datos y Firebase UID sin usar email como clave.
- **external_contracts:** Supabase Auth SSR usa PKCE/cookies; el import consume el formato oficial de Firebase Auth detrás de un adaptador y dry-run.
- **edge_cases:** El import es idempotente por Firebase UID, preserva verificación/disabled y deriva a reset cuando la contraseña no puede conservarse.
- **ui_states:** Login, signup, verificación pendiente, solicitud/confirmación de reset, callback fallido, logout y cuenta deshabilitada tienen estados accesibles y neutrales.
