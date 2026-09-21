# sprint-10-stripe-pro-and-usage · undefined — Diseño

## Scope (archivos que puede tocar)

- `apps/web/src/app/api/stripe/**`
- `apps/web/src/app/api/usage/**`
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
- `docs/**`
- `apps/web/.env.example`
- `spec.json`

## Enfoque

- **data_model:** Se define una única fila canónica de subscriptions por user_id y customer, con stripe_customer_id y stripe_subscription_id únicos cuando no son null. La fila persiste status, current_period_end, cancel_at_period_end, cursor (last_event_created,last_event_id), timestamps y version. La selección determinista entre varias subscriptions, el ledger de eventos, el agregado y ledger idempotente de uso, el override nullable con auditoría append-only, RLS y la convivencia transitoria con user_entitlements y contadores legacy quedan especificados.
- **external_contracts:** Se fijan rutas, métodos, payloads y respuestas exactas; allowlist de redirect; eventos Stripe soportados; traducción de estados; metadata de Checkout; fallback por legacy_id_map; idempotencia; versión API del adaptador; contrato de consume_usage; esquema exhaustivo de entitlement; y reconciliación autenticada con tipos, semántica de applied y eventCursor, selección canónica y errores 404/409 estables.
- **edge_cases:** Los eventos simultáneos y fuera de orden se resuelven mediante (event.created,event.id). Si Stripe devuelve varias subscriptions, se elige la más reciente por ese orden, se registra la anomalía y esa fila determina entitlement y reconcile. Los eventos invoice aplican el estado actual recuperado y, si no cambió, solo avanzan cursor y ledger. También se cubren cancel_at_period_end, estados no habilitantes, frontera mensual UTC, bypass Pro, downgrade sin imputación retroactiva y replays de uso.
- **ui_states:** El Paywall cubre loading, free, trialing, active, past_due, canceled y error; sesión expirada; retornos success/cancel; refetch canónico; errores recuperables y no recuperables con acciones concretas; portal o checkout según estado; teclado y live region.

## Decisiones de la entrevista

- **adv-0168803efb:** ### [adv-cba2e892d6] No se define qué ocurre si un usuario con suscripción activa o trialing solicita otro Checkout: crear una nueva suscripción, reutilizarla o rechazar la operación.

**R:**
- **adv-949798f950:** ### [adv-12f3163c02] La selección de una subscription por `(event.created,event.id)` no es aplicable al listado devuelto por Stripe durante reconcile, porque las subscriptions no contienen esa tupla de evento. Falta definir el criterio observable para elegir entre varias.

**R:**
- **adv-76e3158d9b:** ### [adv-fdba2747d7] No se define si un fallo transitorio durante el primer procesamiento de un webhook queda persistido como resultado definitivo reproducible o si el evento debe poder reintentarse hasta completar sus efectos.

**R:**
- **adv-1cf428659a:** ### [adv-4f13aca2f1] No se define de qué datos se obtiene el entitlement `legacy` ni cómo se resuelven plan, status, currentPeriodEnd y cancelAtPeriodEnd al eliminar un override sin estado Stripe.

**R:**
- **adv-de128dbbde:** ### [adv-82732cb4db] No se especifican códigos HTTP y códigos de error para body inválido o con campos extra, returnTo inválido, sesión ausente y credenciales server-to-server inválidas, por lo que respuestas razonables distintas no pueden clasificarse inequívocamente como PASS o FAIL.

**R:**
- **data_model:** Sí. `subscriptions` tendrá una fila canónica por `user_id`; `stripe_customer_id` y `stripe_subscription_id` serán únicos cuando no sean null. Persistirá `status`, `current_period_end`, `cancel_at_period_end`, `last_event_created`, `last_event_id`, timestamps y `version`. `stripe_events.event_id` será único y guardará tipo, created, estado de procesamiento, resultado saneado y timestamps. El uso se modelará con un agregado único `(user_id,feature,period)` y un ledger idempotente único `(user_id,feature,period,idempotency_key)`. Si se conserva override, será nullable y toda modificación irá a una auditoría append-only con actor, motivo, valores anterior/nuevo y timestamp. RLS permitirá lectura propia de entitlement/subscription saneada, pero ninguna escritura económica desde cliente.
- **error_states:** Contrato JSON estable `{ok,data,error}` con `error:{code,message,retryable}` sin detalles de proveedor. 401 `UNAUTHENTICATED`; 400 `VALIDATION_ERROR`, `INVALID_REDIRECT` o `INVALID_SIGNATURE`; 404 `CUSTOMER_NOT_FOUND`; 409 `CUSTOMER_AMBIGUOUS`, `EVENT_STALE` o `USAGE_CONFLICT`; 429 `QUOTA_EXCEEDED`; 503 `STRIPE_UNAVAILABLE` o `BILLING_UNAVAILABLE`. El webhook responde 200 para replay y evento soportado ya obsoleto, 400 para firma/payload inválido, y 500/503 solo para fallos reintentables sin confirmar procesamiento. Checkout/portal no escriben estado Pro anticipadamente. Los fallos conservan el estado canónico previo y los logs se sanejan.
- **edge_cases:** Sí. El orden autoritativo será `(event.created,event.id)` y solo avanza si es estrictamente posterior al aplicado. `active` y `trialing` conceden Pro incluso con `cancel_at_period_end=true`; `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired` y `paused` se tratan como Free. Si hay varias subscriptions para un customer se elige determinísticamente la más reciente por ese orden y se registra la anomalía. Webhooks simultáneos se serializan por subscription/user. El periodo de usage se obtiene de `clock_timestamp()` UTC dentro de la transacción; operaciones Pro no incrementan contadores y un downgrade reutiliza únicamente el consumo Free previamente acumulado en ese mes.
- **auth_secrets:** El override solo podrá cambiarse mediante una función/RPC no concedida a `authenticated` ni `anon`, invocada por backend administrativo con `service_role`. La operación exige `target_user_id`, valor nullable y `reason` no vacío; el actor se deriva de un identificador administrativo server-side configurado y nunca del payload del navegador. Se auditan intentos aplicados con actor, usuario, before/after, motivo y timestamp. No se crea UI administrativa en este sprint y no se aceptan `plan`, roles ni privilegios desde el cliente.
- **external_contracts:** Rutas: `POST /api/stripe/checkout` con `{returnTo}` allowlisted y respuesta `{ok:true,data:{url}}`; `POST /api/stripe/portal` igual; `POST /api/stripe/webhook` recibe cuerpo crudo y cabecera `stripe-signature`; `GET /api/stripe/entitlement` devuelve `{plan,status,source,currentPeriodEnd,cancelAtPeriodEnd}` saneado; `POST /api/usage/consume` recibe `{feature,idempotencyKey}` y devuelve `{allowed,feature,period,used,limit,remaining,duplicate}`. Se soportan `checkout.session.completed`, `customer.subscription.created|updated|deleted` e `invoice.payment_failed|payment_succeeded`; los no soportados se registran como ignored. Toda Checkout Session lleva `metadata.supabase_user_id`; durante transición se permite resolver un único Firebase UID vía `legacy_id_map`. Stripe SDK queda fijado a la versión API declarada en el adaptador. Las llamadas de creación usan idempotency key server-side derivada de usuario y request.
- **ui_states:** `loading` bloquea acciones y anuncia carga; `free` ofrece checkout; `trialing` y `active` muestran Pro y ofrecen portal; `past_due` muestra acceso Free, aviso de pago y portal; `canceled` muestra Free, fecha final si existe y opción de reactivar mediante checkout; `error` conserva el último estado conocido como no autoritativo y ofrece reintentar. Sesión expirada redirige al login con `returnTo` allowlisted. Los parámetros `success` y `cancel` solo muestran un aviso y fuerzan refetch; nunca alteran entitlement local. Todos los estados y acciones son accesibles por teclado y live region.
- **rollback_compat:** Sí. Migraciones y backfill serán aditivos e idempotentes. Durante la transición, la lectura usa primero `subscriptions`/override y cae a `user_entitlements` solo cuando no existe fila canónica; los contadores legacy se importan sin reducir consumo y quedan intactos. No se eliminan tablas, columnas, mappings Firebase ni contratos de Sprints 5–9. El rollback es por deployment/feature flag y conserva subscriptions, eventos, auditoría, ledgers y usage. La reconciliación puede reanudarse sin duplicados.
- **tests:** Unit/integration con adaptador Stripe falso y reloj inyectable: auth y redirects de checkout, portal válido/sin customer, estados y sanitización. pgTAP: constraints y RLS, firma inválida sin escrituras mediante capa HTTP/integración, replay exacto, eventos concurrentes/fuera de orden, mapping legacy único/ausente/ambiguo, override no invocable por cliente y auditoría, carreras N/N+1 para límites 5/5/10, replay de idempotency key, frontera UTC, bypass Pro y downgrade. Playwright: loading/free/trialing/active/past_due/canceled/error y retornos success/cancel con refetch canónico. Fixtures sintéticos cubren eventos soportados sin secretos ni red. Build test inspecciona artefactos cliente y respuestas/logs para impedir secretos.
