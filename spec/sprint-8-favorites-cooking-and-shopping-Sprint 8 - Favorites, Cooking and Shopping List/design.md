# sprint-8-favorites-cooking-and-shopping · undefined — Diseño

## Scope (archivos que puede tocar)

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

## Enfoque

- **data_model:** Se reutiliza `favorite_recipes` como autoridad, con extensiones aditivas para snapshot JSON validado e inmutable, `snapshot_version`, `version`, timestamps y `deleted_at`, además de unicidad parcial por `(user_id, recipe_id)` para favoritos activos. `cooking_mutations` persiste cada intención y su resultado canónico bajo `UNIQUE(user_id, client_mutation_id)`; el consumo confirmado crea un ledger/meal entry y actualiza inventario versionado. La compra combina una proyección no persistida de faltantes con selecciones explícitas versionadas y con tombstone. IndexedDB conserva réplicas, cursor, outbox y estado local por usuario, sin actuar como autoridad remota.
- **external_contracts:** Se fijan contratos para favorito, cocina y selección explícita de compra, todos identificados por `client_mutation_id` y con versiones esperadas cuando corresponda. Las respuestas usan el sobre `{client_mutation_id,status,code,result,conflicts}`: `applied` devuelve la representación canónica, `duplicate` reproduce byte-semánticamente el resultado persistido del primer intento, `conflict` no escribe dominio y adjunta versiones/snapshots actuales, y `rejected` no se reintenta sin corregir el payload. La outbox se particiona por usuario, conserva el payload original y procesa en orden causal por entidad.
- **edge_cases:** Los ingredientes repetidos solo se agrupan cuando comparten ingrediente canónico y unidad compatible. Cantidades ausentes, ingredientes no mapeados y unidades incompatibles requieren confirmación, mapeo o exclusión explícita. El consumo distribuido usa FEFO determinista por `expiry_date`, `created_at` e `id`; bloquea o compara todas las filas afectadas y valida el plan completo antes de escribir. Cualquier insuficiencia, versión obsoleta o cambio concurrente aborta la transacción completa, devuelve las filas canónicas en conflicto y evita consumos parciales o cantidades negativas.
- **ui_states:** Cada pantalla contempla loading, vacío con acción útil, caché offline fechada, pendiente, sincronizado, conflicto, error recuperable y sesión expirada. Las mutaciones optimistas nunca aparecen como confirmadas antes del servidor; cocinar offline no altera cantidades canónicas visibles. Los conflictos comparan dato local y canónico y ofrecen descartar o revisar y reintentar mediante un nuevo mutation id y versiones actuales. Solo se puede descartar directamente una operación que no haya sido enviada; si pudo alcanzar el servidor, primero debe reconciliarse. Logout detiene workers y oculta o limpia de la vista la caché y outbox del usuario anterior.

## Decisiones de la entrevista

- **adv-5da61e2f3f:** ### [adv-567ed40047] “Snapshot completo y versionado” no define el esquema exacto de ingredientes e instrucciones, campos obligatorios ni significado de la versión; no puede determinarse si un snapshot concreto está completo.

**R:**
- **adv-ca43f7a1b0:** ### [adv-0512ebfc76] No se especifica qué debe ocurrir al cocinar con cantidades ausentes, ingredientes sin correspondencia o unidades incompatibles: rechazar toda la operación, solicitar una corrección o permitir su exclusión explícita.

**R:**
- **adv-cb752d8b44:** ### [adv-3f523bb94e] No se enumeran los códigos estables ni qué condiciones corresponden a conflict frente a rejected; no puede comprobarse el estado y código esperado para cada fallo.

**R:**
- **adv-d4a56d344a:** ### [adv-ce07cbf4ae] No se define el modelo observable de la lista de compra explícita: estados objetivo permitidos, persistencia, edición/eliminación, ni cómo convive una selección explícita con una línea derivada equivalente.

**R:**
- **adv-cef8018ffb:** ## Decisiones registradas
- **data_model:** Reutilizar `favorite_recipes` como tabla autoritativa, añadiendo únicamente campos aditivos si faltan: snapshot JSON validado/versionado con título, ingredientes e instrucciones, `snapshot_version`, `version`, timestamps y `deleted_at`; índice único parcial para un favorito activo por `(user_id, recipe_id)`. El snapshot guardado es inmutable: cambios de match o catálogo no lo reescriben. Registrar cada intención de cocinar en `cooking_mutations` con `UNIQUE(user_id, client_mutation_id)`, payload, estado `pending|applied|conflict|rejected`, código y resultado canónico; el consumo confirmado crea un ledger/meal entry enlazado y actualiza los `inventory_items` versionados. La compra es una proyección de faltantes del snapshot más una tabla mínima de selecciones explícitas propiedad del usuario, versionada y con tombstone; no se persisten faltantes derivados ni estados de sincronización del servidor. IndexedDB mantiene copias por `user_id`, cursor, outbox y estado local de sincronización, nunca como autoridad remota.
- **error_states:** Usar códigos estables y seguros: `VERSION_CONFLICT` (refrescar y rehacer contra las versiones actuales), `INSUFFICIENT_QUANTITY` (editar cantidades o inventario), `UNIT_INCOMPATIBLE` (elegir unidad/mapeo compatible), `INGREDIENT_UNMAPPED` (mapear o excluir explícitamente), `RECIPE_UNAVAILABLE` (usar el snapshot favorito si existe o volver), `UNAUTHENTICATED`/`SESSION_EXPIRED` (iniciar sesión sin procesar la outbox anterior), `FORBIDDEN` (rechazo definitivo), `DUPLICATE` (mostrar exactamente el resultado canónico original) y `NETWORK_PENDING` (mantener pendiente y reintentar al recuperar conexión). Las respuestas son `applied|duplicate|conflict|rejected`; no existen éxitos parciales y solo fallos transitorios se reintentan automáticamente.
- **edge_cases:** Normalizar y agrupar ingredientes repetidos antes de consumir solo cuando coincidan ingrediente canónico y unidad compatible. Cantidades ausentes, ingredientes no mapeados o unidades incompatibles no se descuentan automáticamente: la UI exige confirmación, mapeo o exclusión explícita. Si el stock está repartido, asignar de forma determinista FEFO (`expiry_date`, después `created_at`, después `id`) y bloquear/comparar todas las filas afectadas. La RPC valida primero todos los lotes, cantidades y `expected_version`; cualquier cambio concurrente o insuficiencia aborta la transacción completa, devuelve las filas canónicas en conflicto y nunca deja consumo parcial ni cantidades negativas.
- **auth_secrets:** Sí. Todas las tablas activan RLS por `auth.uid()` y las RPC derivan el propietario de la sesión; ningún `user_id` enviado por cliente es autoritativo. La PWA solo recibe URL y clave publishable/anon de Supabase. Service role y demás secretos permanecen exclusivamente en procesos server-side, nunca en bundles, IndexedDB, respuestas ni logs.
- **external_contracts:** Favorito: operación de estado objetivo `{client_mutation_id, recipe_id, desired_state: "saved"|"removed", snapshot?, expected_version?}`; guardar exige snapshot validado la primera vez y quitar crea tombstone, ambos idempotentes. Cocinar: `{client_mutation_id, favorite_id|recipe_snapshot, lines:[{ingredient_key, inventory_item_id, expected_version, quantity, unit}]}`; la RPC valida el plan completo y devuelve `{client_mutation_id,status,code,result,conflicts}`. Compra explícita: `{client_mutation_id,item_id?,ingredient_key,name,quantity?,unit?,desired_state,expected_version?}` con el mismo sobre. `applied` devuelve la nueva representación canónica; `duplicate` reproduce byte-semánticamente el resultado persistido del primer intento; `conflict` no escribe dominio y adjunta snapshots/versiones actuales; `rejected` no se reintenta sin corregir el payload. La outbox, particionada por usuario, conserva el payload original y procesa en orden causal por entidad.
- **ui_states:** Cada pantalla muestra loading, vacío con acción útil, caché offline con fecha/indicador, pendiente, sincronizado, conflicto, error recuperable y sesión expirada. Favoritos previamente sincronizados siguen legibles offline. Guardar/quitar y selección de compra pueden reflejarse como “pendiente”, nunca como confirmados; cocinar offline permanece pendiente y no altera cantidades visibles como canónicas. Ante conflicto se muestra el dato local y el canónico y se ofrecen “Descartar” o “Revisar y reintentar”; reintentar crea un nuevo mutation id y nuevas expected versions. El usuario puede descartar una operación no enviada; si pudo llegar al servidor se reconcilia primero. Logout cierra workers y oculta/limpia la vista de caché y outbox del usuario anterior.
- **rollback_compat:** Sí. El rollback es únicamente de deployment/feature flag. Migraciones e IndexedDB son aditivas y versionadas; se conservan tablas, snapshots, mutaciones, tombstones y datos legacy. No hay down migrations destructivas, no se modifica el cliente Expo/Firebase y una PWA anterior puede seguir leyendo sus contratos existentes aunque ignore las nuevas tablas/campos.
- **tests:** Unitarios: validación/inmutabilidad de snapshot, recálculo de faltantes, agrupación solo con unidades compatibles, límites cero, FEFO y compactación/outbox. pgTAP/integración: constraints y RLS con dos usuarios, ownership derivado de `auth.uid()`, favorito único activo, consumo atómico sin negativos, lotes múltiples, conflicto por versión/cantidad, dos transacciones competidoras y replay concurrente que descuenta exactamente una vez y devuelve resultado canónico. IndexedDB: reload offline, aislamiento por usuario, pending/no-confirmado, reconciliación y logout. Playwright con Supabase local y viewport 320 px: guardar/quitar favorito, reload offline, pasos, cocinar con éxito, replay, conflicto y resolución, compra derivada/selección explícita, deep links y aislamiento entre usuarios. Todos los gates existentes (lint, typecheck, unit, build y pruebas Supabase/E2E disponibles) deben pasar.

