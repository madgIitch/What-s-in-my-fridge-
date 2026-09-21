# sprint-9-meal-calendar · undefined — Diseño

## Scope (archivos que puede tocar)

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

## Enfoque

- **data_model:** `meal_entries` sigue siendo la tabla canónica para altas manuales y comidas creadas al cocinar. Usa UUID estable generado por el cliente, ownership derivado de sesión, `meal_date` civil, `recipe_id` nullable con `ON DELETE SET NULL`, snapshots JSONB v1, `version` bigint y tombstone `deleted_at`. `recipe_snapshot` es null para comidas custom o `{version:1,recipe_id,title,ingredients,instructions}` para recetas; cada ingrediente usa `{ingredient_key,name,quantity|null,unit|null}`. `ingredients_consumed` es un array v1 de `{inventory_item_id|null,ingredient_key|null,name,quantity|null,unit|null,mutation_id|null}` con `name` obligatorio, cantidad positiva si existe y unidad obligatoria cuando hay cantidad. Debe existir exactamente un snapshot de receta o un `custom_name` no vacío. `meal_type` solo admite `breakfast`, `lunch`, `dinner` y `snack`.
- **external_contracts:** `apply_meal_mutation` recibe exactamente `{client_mutation_id,operation,meal_entry_id,expected_version,payload}`. Create exige `expected_version:null` y payload completo; update exige versión positiva y reemplazo completo; delete exige versión positiva y `payload:null`. Los opcionales se transmiten como null explícito. La respuesta fija es `{client_mutation_id,status,code,result,conflicts}`; `result` contiene la fila canónica completa o null y cada conflicto usa `{entity_id,expected_version,current}`. `UNIQUE(user_id,client_mutation_id)` garantiza replay inmutable del primer resultado canónico. `pull_meal_entries(cursor_updated_at timestamptz|null,cursor_id uuid|null,limit int=200)` devuelve activas y tombstones ordenados por `(updated_at,id)`, junto con `next_cursor` y `has_more`; acepta límites de 1 a 500 y el cursor final solo se persiste tras consumir todas las páginas.
- **edge_cases:** Se permiten múltiples comidas por día. La outbox preserva orden causal por `meal_entry`, compacta create y updates todavía no enviados y elimina create+delete únicamente cuando consta que el create nunca pudo llegar al servidor; si la entrega fue incierta, primero reconcilia y después envía un delete idempotente independiente. El borrador se persiste por `user_id` y `meal_entry_id` al navegar a otro mes, se restaura al volver y solo se descarta explícitamente. Durante un pull paginado no se publica ningún lote ni se avanza el cursor hasta completar todas las páginas; dentro de cada página se deduplica por id conservando la mayor versión y una fila remota solo se aplica si `(version,updated_at,id)` es posterior al estado local confirmado. Una versión remota nunca reemplaza un borrador o mutación pendiente: si es anterior se ignora y si es posterior crea un conflicto visible. Si la receta se elimina mientras existe una edición local, se conserva el snapshot, se establece `recipe_id:null`, el borrador continúa editable y al guardar se muestra el aviso «La receta original ya no existe» sin perder nombre, ingredientes ni notas.
- **ui_states:** La vista mensual contempla loading, mes vacío autoritativo, offline sin caché no autoritativo, caché offline fechada, pending editable, synced, conflict, error recuperable, validación y sesión expirada. Offline sin caché muestra «Sin conexión; aún no hay datos guardados» y «Reintentar». Red, timeout o 5xx conservan el borrador y ofrecen «Reintentar». Los conflictos conservan el borrador, presentan la versión canónica y ofrecen «Descartar mis cambios» o «Revisar y reintentar». Un 401 pausa la outbox y redirige a `/login?error=session_expired&returnTo=<ruta allowlisted>`; después de autenticarse, la sincronización se reanuda reconciliando antes de enviar. Las mutaciones pendientes nunca se muestran como confirmadas. Los tipos se presentan en orden breakfast, lunch, dinner y snack; dentro de cada tipo y día se ordena por `consumed_at` ascendente y después por `created_at,id`, dejando las filas sin `consumed_at` al final.

## Decisiones de la entrevista

- **adv-e979178213:** ### [adv-ea53b39a73] No se define el contrato del pull incremental: endpoint, parámetros, cursor, orden total, paginación, límites ni representación de tombstones.

**R:**
- **adv-cdefa1521b:** ### [adv-4c149921c1] No se define qué ocurre al reutilizar un client_mutation_id con una operación o payload distintos: reproducir el primer resultado o rechazar la colisión.

**R:**
- **adv-e1e39cc230:** ### [adv-4976e66118] No se define cómo resolver mutaciones remotas recibidas fuera de orden para una misma meal_entry, por lo que no existe un criterio determinista para verificar la convergencia causal.

**R:**
- **adv-b802ffdb60:** ### [adv-5f526e29b7] No se concreta el comportamiento de offline sin caché, error recuperable y sesión expirada: acciones disponibles, transiciones, destino de autenticación y tratamiento de la outbox.

**R:**
- **adv-f1ade894a2:** ### [adv-10ced979fa] No se decide si un borrador se conserva al cambiar de mes ni qué sucede si la receta asociada se elimina mientras existe una edición local pendiente.

**R:**
- **edge_cases:** Sí. Se permiten múltiples comidas por día. La outbox preserva orden causal por `meal_entry`, compacta create+updates no enviados y elimina create+delete solo cuando consta que el create nunca pudo llegar al servidor; ante entrega incierta reconcilia primero y envía un delete idempotente independiente.

