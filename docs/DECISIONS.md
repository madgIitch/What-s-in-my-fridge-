# Decisiones (ADR)

Formato por entrada: **fecha · título** — contexto, decisión y consecuencias.
El harness añade entradas cuando se aprueba un spec; el agente también debe añadir entradas cuando toma
una decisión de arquitectura relevante durante implementación.

## Pendientes de decisión

- Proveedor concreto de transcripción y extracción tras las interfaces definidas.
- Política final de conflictos offline y periodos de retención, a decidir en sus sprints.

<!-- Nuevas entradas debajo -->

## 2026-09-21 · Idempotencia y cuota de imports en la misma transacción

`recipe_import_jobs` es el registro canónico y `create_recipe_import_job` serializa por usuario e idempotency key antes de consumir la cuota mensual. Cloud Tasks transporta únicamente el UUID y el worker adquiere un lease mediante RPC service-only; completar vuelve a validar el contrato `recipe-v1` dentro de PostgreSQL. Así, dobles submits y redeliveries no duplican cuota ni resultado, mientras que un fallo de cola queda persistido y reconciliable. El texto/transcript completo no forma parte del resultado durable: solo se conserva provenance y la ruta de extracción.

## 2026-09-20 · Catálogo versionado y reserva atómica de sugerencias

El catálogo de recetas se importa como una versión inmutable identificada por el SHA-256 de una representación JSON canónica; una RPC de importación valida y escribe vocabulario, aliases, recetas e ingredientes y solo activa la versión al final de la misma transacción. Las versiones anteriores se conservan para rollback. Las sugerencias se calculan exclusivamente en servidor con `matcher-v1`; una segunda RPC serializa por usuario y cache key, devuelve hits antes de cuota y crea el claim de una operación nueva junto al consumo mensual. Así, inventario vacío, rechazos, hits y carreras no incrementan el uso, mientras que una operación nueva Free incrementa exactamente una vez. Los mappings verificados siguen siendo privados por usuario y nunca modifican aliases globales.

## 2026-09-20 · Reserva OCR en dos fases y confirmación exactamente una vez

La cuota mensual se reserva bajo bloqueo en PostgreSQL antes de preparar el objeto, se libera si el flujo falla antes de Vision y se convierte en consumo justo antes de invocar al proveedor. Desde ese instante, éxito o fallo facturable consume exactamente una unidad. La confirmación bloquea el draft y deriva IDs deterministas de `(draft_id, line_id)`, de modo que retries y carreras devuelven el primer resultado canónico sin duplicar inventario. Las imágenes permanecen en un bucket privado bajo `auth.uid()/draft_id`; cualquier URL firmada dura 60 segundos y no se persiste.

## 2026-09-17 · Plano interactivo y plano de media separados

La PWA y su orquestación interactiva se despliegan en Vercel; Supabase conserva el estado canónico de aplicación; Google Cloud Tasks y Cloud Run ejecutan las cargas de vídeo/audio e IA. Vercel no descarga ni transcodifica vídeo y Railway queda fuera de la arquitectura 1.0. Esto permite límites, escalado y observabilidad independientes sin introducir una cuarta plataforma.

## 2026-09-17 · Migración strangler sin alterar el cliente móvil

La nueva PWA vive en `apps/web` junto al cliente Expo existente. El legado sirve de referencia hasta que los verticales hayan alcanzado paridad, la migración sea reconciliable y exista rollback probado. Cada contrato funcional se mueve solo en el sprint que lo aprueba.

<!-- harness:sprint-0-pwa-migration-foundation -->
## 2026-09-17 · sprint-0-pwa-migration-foundation aprobado

Contexto: se aprobó el spec `sprint-0-pwa-migration-foundation` (Sprint 0 - PWA Migration Foundation).

Decisión: implementar según el spec aprobado.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

## 2026-09-22 · Sprint 10 — autoridad económica y cuota única

- Stripe se integra exclusivamente desde módulos server-only y se fija `Stripe-Version: 2024-06-20`; Checkout recibe el precio configurado en servidor y el webhook valida la firma sobre el cuerpo crudo antes de cualquier acceso a datos.
- `subscriptions` y `stripe_events` forman la autoridad económica idempotente. Los cursores usan `(event.created,event.id)` con colación byte a byte y las reconciliaciones sintéticas no pueden bloquear un webhook real del mismo segundo.
- `consume_usage` es la única reserva de cuota para OCR, sugerencias e importaciones. Los contadores anteriores quedan como proyecciones aditivas para rollback, nunca como segunda autoridad.
- Las funciones económicas internas revocan explícitamente permisos a `anon` y `authenticated`; solo `consume_usage` y la reserva OCR derivada están disponibles para sesiones autenticadas.

<!-- harness:sprint-1-supabase-platform-foundation -->
## 2026-09-17 · sprint-1-supabase-platform-foundation aprobado

Contexto: se aprobó el spec `sprint-1-supabase-platform-foundation` (Sprint 1 - Supabase Platform Foundation).

Decisiones registradas:

- **auth_secrets:** browser usa URL y publishable key; service role solo en módulo server-only y nunca es necesaria para renderizar la shell.
- **rollback_compat:** cambios aditivos; no se modifica Firebase ni el cliente móvil y las migraciones pueden resetearse en local.
- **tests:** SQL tests prueban CRUD horizontal con dos usuarios y aislamiento de Storage; TypeScript valida separación y tipos generados.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-2-domain-schema-and-migration-mapping -->
## 2026-09-19 · sprint-2-domain-schema-and-migration-mapping aprobado

Contexto: se aprobó el spec `sprint-2-domain-schema-and-migration-mapping` (Sprint 2 - Domain Schema and Migration Mapping).

Decisiones registradas:

- **auth_secrets:** Todas las tablas privadas derivan acceso de auth.uid() mediante RLS; el schema y seeds no requieren ni exponen service role al navegador.
- **rollback_compat:** Migración aditiva, sin modificar ni retirar Firebase o el cliente móvil; cachés no autoritativas se reconstruyen y los registros importados conservan source/legacy_id.
- **tests:** pgTAP con dos usuarios verifica RLS y constraints; tests de dominio validan mappings; seeds se prueban por rerun, cardinalidad y checksum.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-3-auth-and-account-migration -->
## 2026-09-19 · sprint-3-auth-and-account-migration aprobado

Contexto: se aprobó el spec `sprint-3-auth-and-account-migration` (Sprint 3 - Supabase Auth and Account Migration).

Decisiones registradas:

- **auth_secrets:** SCRYPT parameters, service role y export de Firebase viven solo en variables/archivos ignorados; nunca se imprimen ni llegan al navegador.
- **rollback_compat:** Firebase Auth sigue activo durante el ensayo; no se invalidan sesiones ni se hace cutover en este sprint.
- **tests:** Unit/integration cubren redirects allowlisted y errores; pgTAP cubre perfiles; fixtures sintéticos cubren dry-run, rerun y fallback sin secretos reales.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-4-inventory-offline-first -->
## 2026-09-19 · sprint-4-inventory-offline-first aprobado

Contexto: se aprobó el spec `sprint-4-inventory-offline-first` (Sprint 4 - Inventory Offline-First).

Decisiones registradas:

- **auth_secrets:** La sesión Supabase y RLS basada en auth.uid() aíslan todos los datos. El RPC deriva user_id exclusivamente de auth.uid() y no acepta ownership suministrado por el cliente. La publishable/anon key puede ser pública y la service role permanece exclusivamente server-only. pgTAP verifica que un usuario no puede observar ni mutar inventory_items o client_mutations ajenos.
- **rollback_compat:** Los cambios SQL e IndexedDB son aditivos y Firebase, WatermelonDB y Expo permanecen intactos. Los stores y campos nuevos se versionan para que una PWA anterior pueda ignorarlos sin eliminar caché, outbox ni tombstones. El logout desvincula los datos locales de la UI y del worker; otro usuario no puede verlos ni procesarlos. La purga local y la compactación de tombstones quedan fuera de este sprint y requieren políticas posteriores aprobadas.
- **tests:** Playwright usa Supabase local, dos usuarios, dos páginas o contextos y control determinista de conectividad. Los tests unitarios cubren transacciones y compactación Dexie, coordinación entre pestañas, cursor incremental y fechas civiles. pgTAP cubre RLS, deduplicación, compare-and-swap, incremento de versión y tombstones. El E2E verifica UI, IndexedDB y filas canónicas, incluida recarga offline y viewport de 320 px.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-5-receipt-ocr-and-draft-review -->
## 2026-09-20 · sprint-5-receipt-ocr-and-draft-review aprobado

Contexto: se aprobó el spec `sprint-5-receipt-ocr-and-draft-review` (Sprint 5 - Receipt OCR and Draft Review).

Decisiones registradas:

- **auth_secrets:** Las URLs firmadas se emiten exclusivamente en servidor tras validar sesión y ownership, quedan limitadas a lectura de un objeto durante 60 segundos y no se persisten. Se define una política explícita de redacción para credenciales, sesión, URLs, imágenes, OCR y datos personales.
- **rollback_compat:** Los cambios quedan limitados a extensiones SQL/Storage aditivas y rutas PWA nuevas, sin alterar contratos legacy. El rollback conserva drafts, cuotas e imágenes, evita down migrations destructivas y exige una política documentada de expiración que no elimine objetos todavía necesarios.
- **tests:** Se concretan fixtures sintéticos versionados y pruebas unitarias, de integración, pgTAP/Storage y Playwright. La cobertura incluye RLS entre usuarios, MIME real, cuotas concurrentes, replay, confirmación exactamente una vez, rollback transaccional, redacción, ausencia de secretos y verificación de UI, Storage y filas canónicas.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-6-recipe-catalog-normalization-and-suggestions -->
## 2026-09-20 · sprint-6-recipe-catalog-normalization-and-suggestions aprobado

Contexto: se aprobó el spec `sprint-6-recipe-catalog-normalization-and-suggestions` (Sprint 6 - Recipe Catalog, Normalization and Suggestions).

Decisiones registradas:

- **auth_secrets:** Sesión/RLS derivan ownership y los logs no contienen datos privados.
- **rollback_compat:** La migración es aditiva, versionada, idempotente y reversible por deployment.
- **tests:** Hay matriz unit, golden, import, pgTAP, integración y Playwright.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-7-url-recipe-import-jobs -->
## 2026-09-21 · sprint-7-url-recipe-import-jobs aprobado

Contexto: se aprobó el spec `sprint-7-url-recipe-import-jobs` (Sprint 7 - Social Share Recipe Import, Cloud Tasks and Cloud Run Media Pipeline).

Decisión: implementar según el spec aprobado.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-8-favorites-cooking-and-shopping -->
## 2026-09-21 · sprint-8-favorites-cooking-and-shopping aprobado

Contexto: se aprobó el spec `sprint-8-favorites-cooking-and-shopping` (Sprint 8 - Favorites, Cooking and Shopping List).

Decisiones registradas:

- **auth_secrets:** Todas las tablas privadas activan RLS basada en `auth.uid()` y las RPC derivan el propietario exclusivamente de la sesión; ningún `user_id` aportado por el cliente es autoritativo. El navegador solo recibe la URL y clave publishable/anon de Supabase. Service role y demás secretos permanecen server-side y no aparecen en bundles, IndexedDB, respuestas ni logs.
- **rollback_compat:** El rollback se limita al deployment o feature flag. Las migraciones SQL e IndexedDB son aditivas y versionadas, conservan snapshots, mutaciones, tombstones y datos legacy, y no usan down migrations destructivas. No se modifica Expo/Firebase y una PWA anterior puede seguir usando sus contratos existentes aunque ignore las tablas o campos nuevos.
- **tests:** La matriz incluye unitarios de snapshots, faltantes, unidades, límites, FEFO y outbox; pgTAP/integración de constraints, RLS, ownership, atomicidad, concurrencia e idempotencia; pruebas IndexedDB de offline, aislamiento, reconciliación y logout; y Playwright con Supabase local y viewport de 320 px para favoritos, reload offline, pasos, cocina, replay, conflictos, compra, deep links y aislamiento. También exige pasar lint, typecheck, unit, build y las pruebas Supabase/E2E disponibles.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

## 2026-09-21 · Sprint 8 — snapshots inmutables y mutaciones de cocina

- Los favoritos conservan un snapshot v1 autocontenido (`title`, ingredientes estructurados e instrucciones). El inventario solo alimenta una proyección de disponibilidad y nunca reescribe el snapshot.
- Favoritos, cocina y lista explícita usan RPC autenticadas con un ledger idempotente separado por dominio. Cocina bloquea todos los lotes solicitados, valida el plan completo y solo después descuenta y crea el meal entry.
- La caché IndexedDB de Sprint 8 vive en una base aditiva propia y todas sus claves y consultas están particionadas por `userId`; ninguna operación pendiente se presenta como confirmada.

<!-- harness:sprint-9-meal-calendar -->
## 2026-09-21 · sprint-9-meal-calendar aprobado

Contexto: se aprobó el spec `sprint-9-meal-calendar` (Sprint 9 - Meal Calendar).

Decisiones registradas:

- **auth_secrets:** Las RPC derivan ownership exclusivamente de `auth.uid()`, no aceptan un `user_id` autoritativo del cliente y RLS aísla select, insert, update y delete entre usuarios. Caché, borradores, cursores, ledger y outbox se particionan por usuario. Logout detiene la sincronización y evita exposición o procesamiento cruzado. El navegador solo usa la clave publishable/anon y la service role permanece exclusivamente server-side.
- **rollback_compat:** Las migraciones SQL e IndexedDB son aditivas y versionadas. El rollback se limita a deployment o feature flag y conserva filas, snapshots, tombstones, borradores, cursores, ledgers y mutaciones. No rompe el contrato de cocina de Sprint 8 ni los clientes legacy que ignoren los campos o stores nuevos.
- **tests:** La cobertura obligatoria incluye unitarios de fecha civil y DST, snapshots, validación y orden/compactación de outbox; pgTAP e integración de RLS, constraints, idempotencia, CAS, tombstones, pull incremental paginado y atomicidad; y Playwright de los flujos principales, estados offline, borradores entre meses, recarga, reconexión, sesión expirada, receta eliminada durante una edición y conflictos con dos contextos. La matriz temporal mínima usa `Europe/Madrid` en 2026-03-29 y 2026-10-25, `America/New_York` en 2026-03-08 y 2026-11-01, y `UTC` y `Asia/Tokyo` como zonas sin transición en esas fechas; crear, editar, recargar y sincronizar conserva exactamente el `YYYY-MM-DD` elegido.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-10-stripe-pro-and-usage -->
## 2026-09-21 · sprint-10-stripe-pro-and-usage aprobado

Contexto: se aprobó el spec `sprint-10-stripe-pro-and-usage` (Sprint 10 - Stripe Pro and Usage Enforcement).

Decisiones registradas:

- **auth_secrets:** Checkout, portal, entitlement y usage derivan identidad de la sesión; los redirects aceptan únicamente /app/pro; el webhook exige firma sobre cuerpo crudo; reconcile y override son server-to-server con secretos dedicados. Los secretos permanecen server-only y el actor administrativo se deriva de configuración, nunca del navegador.
- **rollback_compat:** Las migraciones y el backfill son aditivos e idempotentes; se define precedencia con fallback a user_entitlements, importación conservadora del consumo legacy, reconciliación repetible sin duplicados y rollback por deployment o feature flag sin eliminar datos.
- **tests:** Se concretan adaptadores falsos, reloj inyectable y fixtures sintéticos sin red; matrices de estados y errores; pgTAP para constraints, RLS, idempotencia y concurrencia; Playwright para Paywall; reconciliación y mappings; eventos invoice sin cambio de estado; múltiples subscriptions; contratos exhaustivos de entitlement y reconcile; replay 429 exacto; y pruebas de ausencia de secretos en artefactos, respuestas y logs.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.
