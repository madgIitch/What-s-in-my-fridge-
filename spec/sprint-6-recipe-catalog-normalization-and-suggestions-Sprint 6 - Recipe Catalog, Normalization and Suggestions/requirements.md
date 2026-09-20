# sprint-6-recipe-catalog-normalization-and-suggestions · undefined — Requisitos

- name: `Sprint 6 - Recipe Catalog, Normalization and Suggestions` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-20T20:16:32.032Z

## Contexto



## Requisitos funcionales

R1. El importador usa `normalizedRecipes` de `whats-in-my-fridge-backend/data/progress.json` y `normalized-ingredients.json`, valida esquema, calcula un SHA-256 canónico y soporta `--dry-run` sin escrituras.
R2. Importar dos veces el mismo checksum conserva cardinalidades y devuelve `already_imported`; una entrada inválida aborta sin activar una versión parcial.
R3. El catálogo activo queda normalizado en `catalog_versions`, `recipes`, `recipe_ingredients`, `ingredients` e `ingredient_aliases`; el navegador nunca descarga el archivo completo ni calcula sugerencias sobre él.
R4. `matcher-v1` reproduce de forma determinista normalización NFD, singularización y estrategias mapping verificado, exact, alias, substring, keyword y fuzzy 0.65.
R5. Golden tests cubren exact, alias, substring, keyword, fuzzy, plural/singular, acentos, ausencia de categoría, inventario vacío y empates.
R6. Para iguales inputs y versiones, el orden es faltantes ascendente, porcentaje descendente y `external_id` ascendente.
R7. Un mapping manual `verified_by_user=true` prevalece para ese usuario sobre aliases y fuzzy sin modificar vocabulario global ni resultados de otro usuario.
R8. `POST /api/recipes/suggestions` exige sesión, rechaza `userId`/ownership aportado y lee exclusivamente inventario activo del usuario autenticado bajo RLS.
R9. La respuesta `recipe-suggestions-v1` contiene `id`, `name`, `matchPercentage`, `matchedIngredients`, `missingIngredients`, `ingredientsWithMeasures` e `instructions`, además de versiones, hash y metadata de cache.
R10. La cache key es SHA-256 del inventario canónico ordenado más `catalogVersion` y `matcherVersion`; TTL es 60 minutos y cambiar inventario o versiones invalida la entrada anterior.
R11. Un cache hit válido, inventario vacío o request rechazado no consume cuota; una operación nueva consume exactamente una unidad aunque dos requests con la misma clave compitan.
R12. El límite Free es 5 operaciones nuevas por usuario y mes UTC; solo entitlement `pro` y `active` omite el límite.
R13. RLS y tests con dos usuarios impiden leer inventario, mappings, cache o usage ajenos y evitan que un request manipule el plan.
R14. `/app/recipes` muestra estados accesibles de carga, vacío, resultados, sin coincidencias, cache, cuota agotada y error retryable, bloqueando doble submit.
R15. La UI muestra porcentaje entero, ingredientes disponibles/faltantes, medidas e instrucciones para cada resultado sin exponer el catálogo completo.
R16. Los cambios son aditivos, no modifican destructivamente Expo/Firebase ni eliminan artefactos legacy; rollback conserva versiones y permite reactivar una anterior.
R17. Typecheck, lint, unit/golden, import dry-run, build, pgTAP/RLS y Playwright móvil pasan con código 0.

## Restricciones

- **error_states:** Respuestas, cuotas, caché e idempotencia tienen resultados observables estables.
- **auth_secrets:** Sesión/RLS derivan ownership y los logs no contienen datos privados.
- **rollback_compat:** La migración es aditiva, versionada, idempotente y reversible por deployment.

