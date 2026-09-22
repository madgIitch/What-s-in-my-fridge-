# sprint-11-pwa-install-offline-shell-and-push · undefined — Diseño

## Scope (archivos que puede tocar)

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

## Enfoque

- **data_model:** Se define `push_subscriptions` con UUID, `user_id`, hash SHA-256 único del endpoint, endpoint, claves, timestamps y `revoked_at`, permitiendo varias suscripciones por usuario y una por dispositivo/navegador. `push_deliveries` mantiene estado, intentos, próximo intento, código seguro y timestamps, con `UNIQUE(subscription_id,event_key)` y `event_key=recipe-job-completed:<job_id>:<completed_version>`.
- **external_contracts:** Se fijan los contratos exactos de POST y DELETE, sus sobres de respuesta, ownership derivado de sesión, códigos estables y el contrato server-only del sender. Antes de reclamar una entrega, el sender relee la fuente canónica y comprueba estado `completed`, resultado `recipe-v1` válido y coincidencia de `completedVersion`. El payload `push-v1` está limitado a 4 KiB y contiene exclusivamente `{type,eventId,path}` con ruta allowlisted.
- **edge_cases:** Se cubren logout y cambio de cuenta, baja pendiente sin red, limpieza de réplicas privadas y outbox, múltiples dispositivos, rotación de endpoint, duplicados, redelivery y jobs reabiertos. La versión de completado forma parte de la clave idempotente para distinguir nuevos eventos válidos del mismo job.
- **ui_states:** La instalación distingue `unsupported`, `available`, `prompting`, `installed`, `dismissed` y `error`, con instalación habilitada solo en `available` y guía manual para iOS sin prompt. Push distingue `unsupported`, `default`, `prompting`, `enabled`, `denied` y `error`; solo `default` permite solicitar permiso y solo `enabled` permite desactivar. Offline conserva los estados canónicos y sus restricciones operativas.

## Decisiones de la entrevista

- **adv-31c87efba3:** ### [adv-5e49dbf3b6] No se especifican el endpoint, método, campos admitidos, límites ni ruta final del Share Target, ni qué constituye una «referencia no sensible» y cuánto tiempo se conserva durante el login.

**R:**
- **adv-bf1c15c237:** ### [adv-6fad794486] No se define cuándo una caché pasa a considerarse «fechada» ni qué antigüedad debe mostrar o aceptar la UI.

**R:**
- **adv-453a3791f0:** ### [adv-0b92791eec] No se especifica el contrato completo del payload Push versionado: campo y valor de versión, valores permitidos de `type`, formato del identificador opaco y rutas admitidas.

**R:**
- **adv-86c5d43e88:** ### [adv-85e0fdb4b5] No se fija el contrato observable de consulta/polling de jobs —ruta, respuesta, estados y cadencia o plazo de convergencia— necesario para decidir si el fallback funciona correctamente.

**R:**
- **adv-66ebd4513b:** ## Decisiones registradas
- **data_model:** Sí. `push_subscriptions` tendrá UUID, `user_id`, hash SHA-256 único del endpoint, endpoint y claves necesarias, timestamps y `revoked_at`; no se cifrarán con una clave ad hoc de aplicación porque deben poder enviarse desde el worker server-side, pero quedarán protegidas por RLS, service role y ausencia total de logs. `push_deliveries` usará `UNIQUE(subscription_id,event_key)` con `event_key=recipe-job-completed:<job_id>:<completed_version>`, estado, intentos, próximo intento, código seguro y timestamps.
- **error_states:** Permiso `denied`, 401/403, payload inválido y configuración/VAPID inválida son terminales hasta acción explícita; 404/410 revocan solo la suscripción; timeout, red, 429 y 5xx reintentan como máximo 3 veces con backoff y jitter. Se persisten únicamente códigos estables y metadatos no sensibles. La UI muestra `denied`, `unsupported` o error recuperable con reintento; offline conserva borradores/outbox y nunca muestra confirmación antes del commit.
- **edge_cases:** En logout o cambio de cuenta se detienen registro/sync, se eliminan las réplicas privadas y outbox del usuario del dispositivo y se intenta desuscribir el endpoint; si no hay red se guarda una baja local pendiente sin exponer datos y el servidor puede revocar por endpoint al siguiente login. Varias suscripciones por usuario están permitidas, una por dispositivo/navegador; rotar endpoint revoca el anterior. Duplicados y jobs reabiertos se resuelven con la clave idempotente y versión de completado.
- **auth_secrets:** Sí. Subscribe/unsubscribe exigen sesión Supabase, `Origin` same-origin y JSON estricto; el servidor ignora cualquier `userId`. `VAPID_PRIVATE_KEY` y service role son server-only; solo `NEXT_PUBLIC_VAPID_PUBLIC_KEY` es pública. Endpoint, claves p256dh/auth, cookies, cabeceras de autorización y payloads privados no se registran ni aparecen en errores, fixtures o bundles.
- **external_contracts:** `POST /api/push/subscriptions` recibe exactamente `{subscription:{endpoint,expirationTime,keys:{p256dh,auth}}}` y devuelve `{ok:true,data:{enabled:true},error:null}`; `DELETE` recibe exactamente `{endpoint}` y devuelve el mismo sobre con `enabled:false`. Ambos derivan ownership de sesión. El sender server-only recibe `{jobId,completedVersion}`, vuelve a leer el job y solo reclama entregas si `state=completed`, `result` valida `recipe-v1` y la versión coincide. Payload `push-v1`, máximo 4 KiB, contiene solo `{type,eventId,path}` con path allowlisted. Códigos estables: `UNAUTHENTICATED`, `ORIGIN_REJECTED`, `INVALID_SUBSCRIPTION`, `PUSH_UNAVAILABLE`, `PUSH_RETRYABLE` y `SUBSCRIPTION_GONE`.
- **ui_states:** Instalación: `unsupported`, `available`, `prompting`, `installed`, `dismissed`, `error`; solo `available` permite instalar y iOS sin prompt muestra guía manual. Push: `unsupported`, `default`, `prompting`, `enabled`, `denied`, `error`; solo `default` solicita permiso y `enabled` permite desactivar. Offline conserva los estados ya canónicos: sin caché, caché fechada, pending, synced, conflict, error recuperable y session_expired; solo pending/synced permiten seguir trabajando, conflict exige elección y session_expired pausa sincronización y redirige a login.
- **rollback_compat:** Sí. Flags server-only e independientes desactivan promoción de instalación, subscribe/send Push y Share Target sin eliminar datos. Cachés tienen versión explícita y `activate` elimina solo versiones conocidas del shell; migraciones son aditivas. Paste URL y polling permanecen siempre como fallback y un rollback de deployment no necesita down migrations.
- **tests:** Chromium cubre install prompt, service worker, offline y Push mock; WebKit y Firefox cubren degradación progresiva, offline aplicable y ausencia segura de APIs. Unit/integration cubren filtro de caché, partición y limpieza por usuario, gesto de permiso, validación de rutas/payload, auth/origin, deduplicación concurrente, commit autoritativo, retries y revocación 404/410. E2E cubre primer arranque offline, caché materializada, pending no confirmado, polling sin Push, notificationclick allowlisted y rechazo de `/api`, respuestas con cookies y SSR autenticado. Capacidades no emulables se documentan y se prueban debajo de E2E con mocks deterministas.

