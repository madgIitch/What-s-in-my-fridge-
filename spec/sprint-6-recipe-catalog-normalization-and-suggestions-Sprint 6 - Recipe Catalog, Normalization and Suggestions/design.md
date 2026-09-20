# sprint-6-recipe-catalog-normalization-and-suggestions · undefined — Diseño

## Scope (archivos que puede tocar)

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

## Enfoque

- **data_model:** Catálogo versionado, ingredientes normalizados, cache y cuota tienen claves e invariantes reproducibles.
- **external_contracts:** Ruta, payload, respuesta, versiones, hash y TTL quedan definidos.
- **edge_cases:** Se fijan normalización, estrategia, categorías ausentes, vacíos y desempates.
- **ui_states:** La ruta de recetas cubre todos los estados funcionales y accesibles.

## Decisiones de la entrevista

- **data_model:** Añadir de forma aditiva `catalog_versions`, `recipes`, `recipe_ingredients`, `ingredient_aliases`, `recipe_suggestion_cache` y `recipe_monthly_usage`. `recipes.external_id` y los slugs canónicos son estables; `(catalog_version, external_id)` y `(recipe_id, position)` son únicos. La versión activa fija también `matcher_version` y checksum SHA-256. El catálogo fuente es `normalizedRecipes` de `whats-in-my-fridge-backend/data/progress.json`; el importador valida su forma, genera checksum canónico, hace upsert y desactiva versiones anteriores sin borrar datos. El vocabulario fuente es `normalized-ingredients.json`. Los mappings verificados permanecen por usuario en `ingredient_mappings` y prevalecen sin mutar alias globales.
- **error_states:** `POST /api/recipes/suggestions` responde éxito `{recipes,inventoryHash,catalogVersion,matcherVersion,cache:{hit,expiresAt}}` y errores estables `{code,message,retryable}`. Códigos: 401 `AUTH_REQUIRED`, 409 `CATALOG_NOT_READY`, 422 `INVENTORY_INVALID`, 429 `SUGGESTION_QUOTA_EXHAUSTED`, 500 `SUGGESTION_FAILED`. El servidor deriva inventario y usuario; ignora/rechaza ownership del cliente. Un cache hit válido no reserva cuota. Una operación nueva reserva y consume exactamente una unidad dentro de la misma transacción que registra la clave; carreras de la misma clave no duplican consumo.
- **edge_cases:** Inventario vacío devuelve `recipes: []` y no consume cuota. Items borrados o con nombre vacío se excluyen. Normalización usa minúsculas, NFD sin diacríticos, espacios colapsados y singularización legacy; no traduce ni inventa equivalencias. Orden de estrategias: mapping verificado, exact, alias, substring, keyword y Levenshtein con umbral 0.65. Category prefilter solo reduce candidatos cuando hay categorías; si ninguna categoría es resoluble se evalúa el catálogo completo para preservar sugerencias. Empates se ordenan por faltantes ascendente, porcentaje descendente y `external_id` ascendente.
- **auth_secrets:** El endpoint requiere sesión Supabase y consulta `inventory_items` bajo `auth.uid()`/RLS. No acepta `userId`, inventario arbitrario, plan ni cuota del cliente. Service role no es necesaria para sugerencias y no llega al navegador. Logs solo incluyen request id, versiones, hash, contadores y duración; nunca nombres de inventario, recetas completas, cookies, tokens o claves.
- **external_contracts:** `POST /api/recipes/suggestions` no requiere body salvo un opcional `forceRefresh:false`; cualquier campo de ownership se rechaza. Contrato `recipe-suggestions-v1`: receta `{id,name,matchPercentage,matchedIngredients,missingIngredients,ingredientsWithMeasures,instructions}`. `matchPercentage` es entero 0..100. Catálogo activo y matcher `matcher-v1` se resuelven server-side. Cache server e IndexedDB usan SHA-256 de items activos ordenados por id con nombre normalizado/categoría/cantidad/unidad más catalog/matcher version, TTL 60 minutos.
- **ui_states:** Ruta `/app/recipes` mobile-first con estados loading, inventario vacío, resultados, sin coincidencias, cache hit, cuota agotada y error retryable. Cada resultado muestra porcentaje, disponibles, faltantes, medidas e instrucciones expandibles. Un control explícito permite actualizar; mientras carga se bloquea doble submit. La pantalla es funcional y accesible, pero la paridad visual final permanece en Sprint 13.
- **rollback_compat:** SQL, rutas y stores son aditivos. No se modifica ni elimina Firebase, Expo, `recipe_cache` legacy ni el catálogo fuente. Rollback vuelve al deployment anterior conservando catálogo/versiones/cache; importar el mismo checksum es no-op y una versión nueva puede activarse sin borrar la anterior.
- **tests:** Unit/golden fixtures fijan normalización, exact, alias, substring, keyword, fuzzy, plural/singular, acentos, categoría ausente, empates y contrato UI. Tests del importador cubren dry-run, checksum, rerun y fallo atómico. pgTAP con dos usuarios cubre RLS, mapping verificado, cache aislada, cuota Free 5 UTC, Pro ilimitado y carreras idempotentes. Integración del endpoint comprueba inventario derivado, cache hit sin cuota y rechazo de userId. Playwright móvil cubre vacío, resultados, refresh, cache, cuota y error.

