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

<!-- harness:sprint-7-url-recipe-import-jobs -->
## sprint-7-url-recipe-import-jobs · Sprint 7 - Social Share Recipe Import, Cloud Tasks and Cloud Run Media Pipeline



### Scope aprobado

  - `apps/web/src/app/(auth)/app/recipes/import/**`
  - `apps/web/src/app/api/recipe-jobs/**`
  - `apps/web/src/app/api/share-target/**`
  - `apps/web/src/app/manifest.ts`
  - `apps/web/public/manifest.webmanifest`
  - `apps/web/src/components/recipe-import/**`
  - `apps/web/src/lib/recipe-import/**`
  - `packages/domain/src/recipe-jobs/**`
  - `packages/domain/src/recipes/**`
  - `services/media-worker/**`
  - `infrastructure/gcp/cloud-run/**`
  - `infrastructure/gcp/cloud-tasks/**`
  - `infrastructure/gcp/storage/**`
  - `supabase/**`
  - `tests/**`
  - `docs/**`
  - `.env.example`
  - `vercel.json`
  - `spec.json`

<!-- harness:sprint-8-favorites-cooking-and-shopping -->
## sprint-8-favorites-cooking-and-shopping · Sprint 8 - Favorites, Cooking and Shopping List



### Scope aprobado

  - `apps/web/src/app/(auth)/app/favorites/**`
  - `apps/web/src/app/(auth)/app/recipes/**`
  - `apps/web/src/app/(auth)/app/shopping-list/**`
  - `apps/web/src/app/api/favorites/**`
  - `apps/web/src/app/api/cooking/**`
  - `apps/web/src/app/api/shopping-list/**`
  - `apps/web/src/components/favorites/**`
  - `apps/web/src/components/cooking/**`
  - `apps/web/src/components/shopping-list/**`
  - `apps/web/src/lib/favorites/**`
  - `apps/web/src/lib/cooking/**`
  - `apps/web/src/lib/shopping-list/**`
  - `apps/web/src/lib/inventory/**`
  - `apps/web/src/lib/supabase/**`
  - `apps/web/src/types/database.generated.ts`
  - `packages/domain/src/favorites/**`
  - `packages/domain/src/cooking/**`
  - `packages/domain/src/shopping-list/**`
  - `supabase/migrations/**`
  - `supabase/tests/**`
  - `tests/fixtures/recipes/**`
  - `tests/e2e/favorites-cooking-shopping*.spec.ts`
  - `docs/**`
  - `spec.json`

### Contexto técnico

- **data_model:** Se reutiliza `favorite_recipes` como autoridad, con extensiones aditivas para snapshot JSON validado e inmutable, `snapshot_version`, `version`, timestamps y `deleted_at`, además de unicidad parcial por `(user_id, recipe_id)` para favoritos activos. `cooking_mutations` persiste cada intención y su resultado canónico bajo `UNIQUE(user_id, client_mutation_id)`; el consumo confirmado crea un ledger/meal entry y actualiza inventario versionado. La compra combina una proyección no persistida de faltantes con selecciones explícitas versionadas y con tombstone. IndexedDB conserva réplicas, cursor, outbox y estado local por usuario, sin actuar como autoridad remota.
- **external_contracts:** Se fijan contratos para favorito, cocina y selección explícita de compra, todos identificados por `client_mutation_id` y con versiones esperadas cuando corresponda. Las respuestas usan el sobre `{client_mutation_id,status,code,result,conflicts}`: `applied` devuelve la representación canónica, `duplicate` reproduce byte-semánticamente el resultado persistido del primer intento, `conflict` no escribe dominio y adjunta versiones/snapshots actuales, y `rejected` no se reintenta sin corregir el payload. La outbox se particiona por usuario, conserva el payload original y procesa en orden causal por entidad.
- **edge_cases:** Los ingredientes repetidos solo se agrupan cuando comparten ingrediente canónico y unidad compatible. Cantidades ausentes, ingredientes no mapeados y unidades incompatibles requieren confirmación, mapeo o exclusión explícita. El consumo distribuido usa FEFO determinista por `expiry_date`, `created_at` e `id`; bloquea o compara todas las filas afectadas y valida el plan completo antes de escribir. Cualquier insuficiencia, versión obsoleta o cambio concurrente aborta la transacción completa, devuelve las filas canónicas en conflicto y evita consumos parciales o cantidades negativas.
- **ui_states:** Cada pantalla contempla loading, vacío con acción útil, caché offline fechada, pendiente, sincronizado, conflicto, error recuperable y sesión expirada. Las mutaciones optimistas nunca aparecen como confirmadas antes del servidor; cocinar offline no altera cantidades canónicas visibles. Los conflictos comparan dato local y canónico y ofrecen descartar o revisar y reintentar mediante un nuevo mutation id y versiones actuales. Solo se puede descartar directamente una operación que no haya sido enviada; si pudo alcanzar el servidor, primero debe reconciliarse. Logout detiene workers y oculta o limpia de la vista la caché y outbox del usuario anterior.

<!-- harness:sprint-9-meal-calendar -->
## sprint-9-meal-calendar · Sprint 9 - Meal Calendar



### Scope aprobado

  - `apps/web/src/app/(auth)/app/calendar/**`
  - `apps/web/src/app/api/meals/**`
  - `apps/web/src/components/meal-calendar/**`
  - `apps/web/src/lib/meal-calendar/**`
  - `apps/web/src/lib/supabase/**`
  - `apps/web/src/types/database.generated.ts`
  - `packages/domain/src/meals/**`
  - `supabase/migrations/**`
  - `supabase/tests/**`
  - `tests/e2e/meal-calendar*.spec.ts`
  - `docs/**`
  - `spec.json`

### Contexto técnico

- **data_model:** `meal_entries` sigue siendo la tabla canónica para altas manuales y comidas creadas al cocinar. Usa UUID estable generado por el cliente, ownership derivado de sesión, `meal_date` civil, `recipe_id` nullable con `ON DELETE SET NULL`, snapshots JSONB v1, `version` bigint y tombstone `deleted_at`. `recipe_snapshot` es null para comidas custom o `{version:1,recipe_id,title,ingredients,instructions}` para recetas; cada ingrediente usa `{ingredient_key,name,quantity|null,unit|null}`. `ingredients_consumed` es un array v1 de `{inventory_item_id|null,ingredient_key|null,name,quantity|null,unit|null,mutation_id|null}` con `name` obligatorio, cantidad positiva si existe y unidad obligatoria cuando hay cantidad. Debe existir exactamente un snapshot de receta o un `custom_name` no vacío. `meal_type` solo admite `breakfast`, `lunch`, `dinner` y `snack`.
- **external_contracts:** `apply_meal_mutation` recibe exactamente `{client_mutation_id,operation,meal_entry_id,expected_version,payload}`. Create exige `expected_version:null` y payload completo; update exige versión positiva y reemplazo completo; delete exige versión positiva y `payload:null`. Los opcionales se transmiten como null explícito. La respuesta fija es `{client_mutation_id,status,code,result,conflicts}`; `result` contiene la fila canónica completa o null y cada conflicto usa `{entity_id,expected_version,current}`. `UNIQUE(user_id,client_mutation_id)` garantiza replay inmutable del primer resultado canónico. `pull_meal_entries(cursor_updated_at timestamptz|null,cursor_id uuid|null,limit int=200)` devuelve activas y tombstones ordenados por `(updated_at,id)`, junto con `next_cursor` y `has_more`; acepta límites de 1 a 500 y el cursor final solo se persiste tras consumir todas las páginas.
- **edge_cases:** Se permiten múltiples comidas por día. La outbox preserva orden causal por `meal_entry`, compacta create y updates todavía no enviados y elimina create+delete únicamente cuando consta que el create nunca pudo llegar al servidor; si la entrega fue incierta, primero reconcilia y después envía un delete idempotente independiente. El borrador se persiste por `user_id` y `meal_entry_id` al navegar a otro mes, se restaura al volver y solo se descarta explícitamente. Durante un pull paginado no se publica ningún lote ni se avanza el cursor hasta completar todas las páginas; dentro de cada página se deduplica por id conservando la mayor versión y una fila remota solo se aplica si `(version,updated_at,id)` es posterior al estado local confirmado. Una versión remota nunca reemplaza un borrador o mutación pendiente: si es anterior se ignora y si es posterior crea un conflicto visible. Si la receta se elimina mientras existe una edición local, se conserva el snapshot, se establece `recipe_id:null`, el borrador continúa editable y al guardar se muestra el aviso «La receta original ya no existe» sin perder nombre, ingredientes ni notas.
- **ui_states:** La vista mensual contempla loading, mes vacío autoritativo, offline sin caché no autoritativo, caché offline fechada, pending editable, synced, conflict, error recuperable, validación y sesión expirada. Offline sin caché muestra «Sin conexión; aún no hay datos guardados» y «Reintentar». Red, timeout o 5xx conservan el borrador y ofrecen «Reintentar». Los conflictos conservan el borrador, presentan la versión canónica y ofrecen «Descartar mis cambios» o «Revisar y reintentar». Un 401 pausa la outbox y redirige a `/login?error=session_expired&returnTo=<ruta allowlisted>`; después de autenticarse, la sincronización se reanuda reconciliando antes de enviar. Las mutaciones pendientes nunca se muestran como confirmadas. Los tipos se presentan en orden breakfast, lunch, dinner y snack; dentro de cada tipo y día se ordena por `consumed_at` ascendente y después por `created_at,id`, dejando las filas sin `consumed_at` al final.

<!-- harness:sprint-10-stripe-pro-and-usage -->
## sprint-10-stripe-pro-and-usage · Sprint 10 - Stripe Pro and Usage Enforcement



### Scope aprobado

  - `apps/web/src/app/api/stripe/**`
  - `apps/web/src/app/api/usage/**`
  - `apps/web/src/app/api/ocr/**`
  - `apps/web/src/app/api/recipes/suggestions/**`
  - `apps/web/src/app/api/recipe-jobs/**`
  - `apps/web/src/app/(auth)/app/pro/**`
  - `apps/web/src/components/billing/**`
  - `apps/web/src/lib/billing/**`
  - `apps/web/src/lib/supabase/**`
  - `apps/web/src/types/database.generated.ts`
  - `packages/domain/src/billing/**`
  - `supabase/migrations/**`
  - `supabase/tests/**`
  - `scripts/migration/stripe/**`
  - `tests/fixtures/stripe/**`
  - `tests/e2e/stripe-pro-usage*.spec.ts`
  - `apps/web/tests/e2e/stripe-pro-usage*.spec.ts`
  - `apps/web/tests/e2e/stripe-pro-usage-paywall.spec.ts`
  - `docs/**`
  - `apps/web/.env.example`
  - `apps/web/package.json`
  - `apps/web/pnpm-lock.yaml`
  - `apps/web/vitest.config.ts`
  - `spec.json`

### Contexto técnico

- **data_model:** Se define una única fila canónica de subscriptions por user_id y customer, con stripe_customer_id y stripe_subscription_id únicos cuando no son null. La fila persiste status, current_period_end, cancel_at_period_end, cursor (last_event_created,last_event_id), timestamps y version. La selección determinista entre varias subscriptions, el ledger de eventos, el agregado y ledger idempotente de uso, el override nullable con auditoría append-only, RLS y la convivencia transitoria con user_entitlements y contadores legacy quedan especificados.
- **external_contracts:** Se fijan rutas, métodos, payloads y respuestas exactas; allowlist de redirect; eventos Stripe soportados; traducción de estados; metadata de Checkout; fallback por legacy_id_map; idempotencia; versión API del adaptador; contrato de consume_usage; esquema exhaustivo de entitlement; y reconciliación autenticada con tipos, semántica de applied y eventCursor, selección canónica y errores 404/409 estables.
- **edge_cases:** Los eventos simultáneos y fuera de orden se resuelven mediante (event.created,event.id). Si Stripe devuelve varias subscriptions, se elige la más reciente por ese orden, se registra la anomalía y esa fila determina entitlement y reconcile. Los eventos invoice aplican el estado actual recuperado y, si no cambió, solo avanzan cursor y ledger. También se cubren cancel_at_period_end, estados no habilitantes, frontera mensual UTC, bypass Pro, downgrade sin imputación retroactiva y replays de uso.
- **ui_states:** El Paywall cubre loading, free, trialing, active, past_due, canceled y error; sesión expirada; retornos success/cancel; refetch canónico; errores recuperables y no recuperables con acciones concretas; portal o checkout según estado; teclado y live region.

<!-- harness:sprint-11-pwa-install-offline-shell-and-push -->
## sprint-11-pwa-install-offline-shell-and-push · Sprint 11 - PWA Install, Offline Shell and Web Push



### Scope aprobado

  - `apps/web/src/app/manifest.ts`
  - `apps/web/public/manifest.webmanifest`
  - `apps/web/public/icons/**`
  - `apps/web/public/sw.js`
  - `apps/web/src/app/(auth)/app/**`
  - `apps/web/src/app/api/push/**`
  - `apps/web/src/app/api/recipe-jobs/**`
  - `apps/web/src/app/api/share-target/**`
  - `apps/web/src/components/pwa/**`
  - `apps/web/src/lib/pwa/**`
  - `apps/web/src/lib/push/**`
  - `apps/web/src/lib/recipe-import/**`
  - `apps/web/src/types/database.generated.ts`
  - `packages/domain/src/push/**`
  - `packages/domain/src/recipe-jobs/**`
  - `supabase/migrations/**`
  - `supabase/tests/**`
  - `tests/e2e/pwa*.spec.ts`
  - `tests/e2e/push*.spec.ts`
  - `tests/fixtures/push/**`
  - `docs/**`
  - `.env.example`
  - `spec.json`

### Contexto técnico

- **data_model:** Se define `push_subscriptions` con UUID, `user_id`, hash SHA-256 único del endpoint, endpoint, claves, timestamps y `revoked_at`, permitiendo varias suscripciones por usuario y una por dispositivo/navegador. `push_deliveries` mantiene estado, intentos, próximo intento, código seguro y timestamps, con `UNIQUE(subscription_id,event_key)` y `event_key=recipe-job-completed:<job_id>:<completed_version>`.
- **external_contracts:** Se fijan los contratos exactos de POST y DELETE, sus sobres de respuesta, ownership derivado de sesión, códigos estables y el contrato server-only del sender. Antes de reclamar una entrega, el sender relee la fuente canónica y comprueba estado `completed`, resultado `recipe-v1` válido y coincidencia de `completedVersion`. El payload `push-v1` está limitado a 4 KiB y contiene exclusivamente `{type,eventId,path}` con ruta allowlisted.
- **edge_cases:** Se cubren logout y cambio de cuenta, baja pendiente sin red, limpieza de réplicas privadas y outbox, múltiples dispositivos, rotación de endpoint, duplicados, redelivery y jobs reabiertos. La versión de completado forma parte de la clave idempotente para distinguir nuevos eventos válidos del mismo job.
- **ui_states:** La instalación distingue `unsupported`, `available`, `prompting`, `installed`, `dismissed` y `error`, con instalación habilitada solo en `available` y guía manual para iOS sin prompt. Push distingue `unsupported`, `default`, `prompting`, `enabled`, `denied` y `error`; solo `default` permite solicitar permiso y solo `enabled` permite desactivar. Offline conserva los estados canónicos y sus restricciones operativas.

