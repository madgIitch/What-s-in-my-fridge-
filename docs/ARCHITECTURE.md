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

<!-- harness:sprint-4-inventory-offline-first -->
## sprint-4-inventory-offline-first · Sprint 4 - Inventory Offline-First



### Scope aprobado

  - `apps/web/src/app/**`
  - `apps/web/src/components/**`
  - `apps/web/src/lib/inventory/**`
  - `apps/web/src/lib/supabase/**`
  - `apps/web/src/types/database.generated.ts`
  - `apps/web/public/**`
  - `packages/domain/**`
  - `supabase/migrations/**`
  - `tests/**`
  - `docs/**`
  - `spec.json`

### Contexto técnico

- **data_model:** La outbox local queda particionada por user_id y registra client_mutation_id UUID, operation, item_id, payload validado, expected_version, estado, intentos y timestamps. public.client_mutations aplica UNIQUE(user_id, client_mutation_id) y conserva el resultado canónico para deduplicación. El pull incremental usa el cursor estable (updated_at, id), incluye tombstones y no los purga en este sprint.
- **external_contracts:** El RPC autenticado apply_inventory_mutation recibe client_mutation_id uuid, operation create|update|delete, item_id uuid, expected_version bigint|null y payload jsonb. En una única transacción valida, deduplica, realiza compare-and-swap y escribe. Devuelve {client_mutation_id,status,code,item}, con status applied|duplicate|conflict|rejected, códigos estables y la fila canónica o remota con su versión. Create exige expected_version null; update y delete exigen una versión positiva. Un duplicate reproduce el resultado almacenado de la primera aplicación.
- **edge_cases:** expiry_date es una fecha civil YYYY-MM-DD sin conversión de zona. Web Locks, con lease persistente de respaldo, elige un único consumidor entre pestañas; BroadcastChannel propaga avisos y el pull es la fuente final de convergencia. Se conserva el orden causal por item. Create y updates pendientes se compactan; create seguido de delete antes de cualquier envío elimina ambos localmente. Si el create pudo alcanzar el servidor, se encola un delete nuevo para el mismo item_id, con su propio client_mutation_id.
- **ui_states:** Loading, vacío, offline sin caché, pending, synced, conflict y error tienen texto accesible y controles utilizables por teclado. Un conflicto conserva la edición local, presenta el snapshot remoto y ofrece Descartar mis cambios o Reintentar con la versión actual. La segunda acción crea una mutación nueva basada explícitamente en la versión remota; no existe last-write-wins automático.

<!-- harness:sprint-5-receipt-ocr-and-draft-review -->
## sprint-5-receipt-ocr-and-draft-review · Sprint 5 - Receipt OCR and Draft Review



### Scope aprobado

  - `apps/web/src/app/**/receipt*/**`
  - `apps/web/src/app/api/ocr/**`
  - `apps/web/src/components/receipt/**`
  - `apps/web/src/lib/receipt/**`
  - `apps/web/src/lib/vision/**`
  - `apps/web/src/lib/supabase/**`
  - `apps/web/src/types/database.generated.ts`
  - `packages/domain/src/receipt/**`
  - `supabase/migrations/**`
  - `supabase/tests/**`
  - `tests/fixtures/receipts/**`
  - `tests/e2e/receipt-ocr*.spec.ts`
  - `apps/web/.env.example`
  - `docs/**`
  - `spec.json`

### Contexto técnico

- **data_model:** Se define una extensión aditiva de receipt_drafts con estados persistidos, referencia privada de imagen, identificador idempotente, versión del parser, snapshots OCR, líneas originales y editadas, errores, periodo de cuota y confirmación. La confirmación usa una RPC transaccional con bloqueo, IDs deterministas y constraints únicas para devolver un resultado canónico sin duplicados ni efectos parciales.
- **external_contracts:** Se fija una autoridad server-side única para entitlement Free/Pro y un adaptador Vision versionado con entrada validada, request_id, timeout de 15 segundos, un único retry interno transitorio, límite de respuesta, salida normalizada y mock determinista sin red.
- **edge_cases:** Se cubren corrupción y dimensiones inválidas, orientación EXIF, eliminación de metadata, cancelación del crop, locales, fechas e importes ambiguos, moneda sin evidencia y líneas parcialmente reconocidas. Los campos inciertos permanecen nulos y editables en vez de ser inventados.
- **ui_states:** Se especifican los estados visibles desde selección hasta confirmación, las acciones habilitadas o bloqueadas, las rutas de recuperación y el tratamiento de OCR vacío y cuota agotada. También se definen live regions, gestión de foco y la prohibición de mostrar éxito antes del commit canónico.

<!-- harness:sprint-6-recipe-catalog-normalization-and-suggestions -->
## sprint-6-recipe-catalog-normalization-and-suggestions · Sprint 6 - Recipe Catalog, Normalization and Suggestions



### Scope aprobado

  - `apps/web/src/app/(auth)/app/recipes/**`
  - `apps/web/src/app/api/recipes/**`
  - `apps/web/src/components/recipes/**`
  - `apps/web/src/lib/recipes/**`
  - `apps/web/src/lib/inventory/**`
  - `apps/web/src/lib/supabase/**`
  - `apps/web/src/types/database.generated.ts`
  - `packages/domain/src/recipes/**`
  - `scripts/migration/catalog/**`
  - `supabase/migrations/**`
  - `supabase/tests/**`
  - `tests/fixtures/recipes/**`
  - `tests/e2e/recipe-suggestions*.spec.ts`
  - `docs/**`
  - `spec.json`

### Contexto técnico

- **data_model:** Catálogo versionado, ingredientes normalizados, cache y cuota tienen claves e invariantes reproducibles.
- **external_contracts:** Ruta, payload, respuesta, versiones, hash y TTL quedan definidos.
- **edge_cases:** Se fijan normalización, estrategia, categorías ausentes, vacíos y desempates.
- **ui_states:** La ruta de recetas cubre todos los estados funcionales y accesibles.

