# sprint-6-recipe-catalog-normalization-and-suggestions · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [ ] (T1) El importador usa `normalizedRecipes` de `whats-in-my-fridge-backend/data/progress.json` y `normalized-ingredients.json`, valida esquema, calcula un SHA-256 canónico y soporta `--dry-run` sin escrituras.  ↔ R1
- [ ] (T2) Importar dos veces el mismo checksum conserva cardinalidades y devuelve `already_imported`; una entrada inválida aborta sin activar una versión parcial.  ↔ R2
- [ ] (T3) El catálogo activo queda normalizado en `catalog_versions`, `recipes`, `recipe_ingredients`, `ingredients` e `ingredient_aliases`; el navegador nunca descarga el archivo completo ni calcula sugerencias sobre él.  ↔ R3
- [ ] (T4) `matcher-v1` reproduce de forma determinista normalización NFD, singularización y estrategias mapping verificado, exact, alias, substring, keyword y fuzzy 0.65.  ↔ R4
- [ ] (T5) Golden tests cubren exact, alias, substring, keyword, fuzzy, plural/singular, acentos, ausencia de categoría, inventario vacío y empates.  ↔ R5
- [ ] (T6) Para iguales inputs y versiones, el orden es faltantes ascendente, porcentaje descendente y `external_id` ascendente.  ↔ R6
- [ ] (T7) Un mapping manual `verified_by_user=true` prevalece para ese usuario sobre aliases y fuzzy sin modificar vocabulario global ni resultados de otro usuario.  ↔ R7
- [ ] (T8) `POST /api/recipes/suggestions` exige sesión, rechaza `userId`/ownership aportado y lee exclusivamente inventario activo del usuario autenticado bajo RLS.  ↔ R8
- [ ] (T9) La respuesta `recipe-suggestions-v1` contiene `id`, `name`, `matchPercentage`, `matchedIngredients`, `missingIngredients`, `ingredientsWithMeasures` e `instructions`, además de versiones, hash y metadata de cache.  ↔ R9
- [ ] (T10) La cache key es SHA-256 del inventario canónico ordenado más `catalogVersion` y `matcherVersion`; TTL es 60 minutos y cambiar inventario o versiones invalida la entrada anterior.  ↔ R10
- [ ] (T11) Un cache hit válido, inventario vacío o request rechazado no consume cuota; una operación nueva consume exactamente una unidad aunque dos requests con la misma clave compitan.  ↔ R11
- [ ] (T12) El límite Free es 5 operaciones nuevas por usuario y mes UTC; solo entitlement `pro` y `active` omite el límite.  ↔ R12
- [ ] (T13) RLS y tests con dos usuarios impiden leer inventario, mappings, cache o usage ajenos y evitan que un request manipule el plan.  ↔ R13
- [ ] (T14) `/app/recipes` muestra estados accesibles de carga, vacío, resultados, sin coincidencias, cache, cuota agotada y error retryable, bloqueando doble submit.  ↔ R14
- [ ] (T15) La UI muestra porcentaje entero, ingredientes disponibles/faltantes, medidas e instrucciones para cada resultado sin exponer el catálogo completo.  ↔ R15
- [ ] (T16) Los cambios son aditivos, no modifican destructivamente Expo/Firebase ni eliminan artefactos legacy; rollback conserva versiones y permite reactivar una anterior.  ↔ R16
- [ ] (T17) Typecheck, lint, unit/golden, import dry-run, build, pgTAP/RLS y Playwright móvil pasan con código 0.  ↔ R17
- [ ] Tests que cubran los criterios de aceptación
