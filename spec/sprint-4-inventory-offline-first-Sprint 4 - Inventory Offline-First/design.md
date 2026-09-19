# sprint-4-inventory-offline-first · undefined — Diseño

## Scope (archivos que puede tocar)

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

## Enfoque

- **data_model:** La outbox local queda particionada por user_id y registra client_mutation_id UUID, operation, item_id, payload validado, expected_version, estado, intentos y timestamps. public.client_mutations aplica UNIQUE(user_id, client_mutation_id) y conserva el resultado canónico para deduplicación. El pull incremental usa el cursor estable (updated_at, id), incluye tombstones y no los purga en este sprint.
- **external_contracts:** El RPC autenticado apply_inventory_mutation recibe client_mutation_id uuid, operation create|update|delete, item_id uuid, expected_version bigint|null y payload jsonb. En una única transacción valida, deduplica, realiza compare-and-swap y escribe. Devuelve {client_mutation_id,status,code,item}, con status applied|duplicate|conflict|rejected, códigos estables y la fila canónica o remota con su versión. Create exige expected_version null; update y delete exigen una versión positiva. Un duplicate reproduce el resultado almacenado de la primera aplicación.
- **edge_cases:** expiry_date es una fecha civil YYYY-MM-DD sin conversión de zona. Web Locks, con lease persistente de respaldo, elige un único consumidor entre pestañas; BroadcastChannel propaga avisos y el pull es la fuente final de convergencia. Se conserva el orden causal por item. Create y updates pendientes se compactan; create seguido de delete antes de cualquier envío elimina ambos localmente. Si el create pudo alcanzar el servidor, se encola un delete nuevo para el mismo item_id, con su propio client_mutation_id.
- **ui_states:** Loading, vacío, offline sin caché, pending, synced, conflict y error tienen texto accesible y controles utilizables por teclado. Un conflicto conserva la edición local, presenta el snapshot remoto y ofrece Descartar mis cambios o Reintentar con la versión actual. La segunda acción crea una mutación nueva basada explícitamente en la versión remota; no existe last-write-wins automático.

## Decisiones de la entrevista

- **adv-44664321b9:** ### [adv-802c5f0377] No se define qué resultado debe devolver el servidor si se reutiliza un client_mutation_id con un payload u operación diferente: devolver el resultado original o rechazar la colisión.

**R:**
- **adv-0d1c6b8e2d:** ### [adv-41e6c45c87] No se clasifican los errores reintentables frente a los permanentes ni se concretan el backoff mínimo/máximo, número de intentos o momento en que un fallo pasa a estado error.

**R:**
- **adv-ecc0468c5e:** ### [adv-0e3951dedd] No se define la política de resolución de conflictos: qué debe ocurrir con la mutación conflictiva y con las mutaciones posteriores del mismo item que dependen causalmente de ella.

**R:**
- **adv-15dbae516e:** ### [adv-d2edaafe14] No se enumeran las zonas horarias soportadas ni el rango de fechas sobre el que debe demostrarse que expiry_date conserva el día civil elegido.

**R:**
- **adv-392a470016:** ## Decisiones registradas
- **data_model:** Sí. La outbox local se particiona por `user_id`; cada mutación usa un UUID `client_mutation_id`, operación, `item_id`, payload validado, `expected_version`, estado, intentos y timestamps. `public.client_mutations` impone `UNIQUE(user_id, client_mutation_id)` y conserva el resultado canónico para reruns. Los tombstones no se purgan en este sprint; su compactación requiere una política posterior aprobada. El pull incremental usa el par `(updated_at, id)` como cursor estable y siempre incluye tombstones.
- **error_states:** `NETWORK_ERROR`, timeout y 5xx son reintentables con backoff exponencial con jitter (1 s, 2 s, 4 s, 8 s, 16 s, máximo 30 s) y hasta 5 intentos automáticos por sesión de sincronización; después quedan en `error` pero pueden reintentarse manualmente o en la siguiente reconexión. `AUTH_REQUIRED` pausa toda la cola hasta recuperar sesión. `FORBIDDEN` y `VALIDATION_ERROR` son permanentes y no se reintentan automáticamente. `SYNC_CONFLICT` queda en `conflict` y requiere resolución explícita. Ningún fallo elimina la mutación local.
- **edge_cases:** Sí. `expiry_date` es fecha civil `YYYY-MM-DD` y nunca pasa por conversión de zona. Una elección determinista entre pestañas mediante Web Locks, con lease persistente de respaldo, garantiza un solo consumidor; BroadcastChannel notifica cambios y el pull sigue siendo la fuente de convergencia. Las mutaciones preservan orden causal por item. Create+updates pendientes se compactan al payload final; create+delete aún no enviado elimina ambos localmente; si el create pudo llegar al servidor, se conserva/enfila delete con el mismo UUID.
- **external_contracts:** Un RPC autenticado `apply_inventory_mutation` recibe `client_mutation_id uuid`, `operation enum(create|update|delete)`, `item_id uuid`, `expected_version bigint|null` y `payload jsonb`. Deriva `user_id` exclusivamente de `auth.uid()`, valida payload y ejecuta deduplicación, compare-and-swap y escritura en una transacción. Responde siempre con `{client_mutation_id,status,code,item}` donde `status` es `applied|duplicate|conflict|rejected`; `code` usa `OK|SYNC_CONFLICT|AUTH_REQUIRED|FORBIDDEN|VALIDATION_ERROR`, e `item` contiene la fila canónica/remota incluida su versión. Create exige `expected_version=null`; update/delete exigen versión positiva. Un duplicate devuelve el resultado almacenado de la primera aplicación.
- **ui_states:** Sí. El conflicto conserva la edición local y muestra también el snapshot remoto. Ofrece `Descartar mis cambios` (adopta remoto) y `Reintentar con la versión actual` (crea una nueva mutación explícita basada en la versión remota). No hay last-write-wins automático. Loading, vacío, offline sin caché, pending, synced, conflict y error tienen texto accesible y foco/acciones utilizables por teclado.
- **rollback_compat:** Sí. Todo cambio SQL y de IndexedDB es aditivo. Firebase, WatermelonDB y el cliente Expo quedan intactos. Stores y campos nuevos se versionan para que una PWA anterior pueda ignorarlos sin borrar caché, outbox o tombstones. El logout deja datos cifrados por el aislamiento del navegador pero los desvincula de UI/worker; otro usuario nunca los ve ni procesa. La purga local será una acción explícita posterior, no parte del rollback.
- **tests:** Sí. Playwright usa Supabase local, dos usuarios y dos páginas/contextos con control determinista de conectividad. Tests unitarios cubren transacciones/compactación/coordinación Dexie, cursor y fechas; pgTAP cubre RLS, deduplicación, compare-and-swap, incremento de versión y tombstones. El E2E comprueba UI, IndexedDB y fila canónica, incluido reload offline y viewport 320 px.

