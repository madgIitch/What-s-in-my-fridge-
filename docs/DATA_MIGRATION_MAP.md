# Mapa de migración de datos de dominio

| Origen | Destino | Identidad y ownership | Transformación |
| --- | --- | --- | --- |
| Firestore `users/{uid}/inventory/{id}` / WatermelonDB `inventory_items` | `public.inventory_items` | `profiles.legacy_uid -> user_id`; `source=FIREBASE`; `legacy_id` es la ruta completa | Conserva fechas ISO, cantidad, unidad, notas y `deleted_at`; genera UUID estable una sola vez. |
| Draft local de ticket | `public.receipt_drafts` | mismo mapping de usuario; ruta/document id en `legacy_id` | Imagen no autoritativa; conserva texto, comercio, compra, moneda, total, líneas, no reconocidas y confirmación. |
| Firestore `savedRecipes` | `public.favorite_recipes` | mismo mapping de usuario; ruta completa en `legacy_id` | Persiste el snapshot completo visible al guardar; no referencia `recipe_cache`. |
| Firestore/WatermelonDB `meal_entries` | `public.meal_entries` | mismo mapping de usuario; ruta completa en `legacy_id` | Conserva fecha/tipo, receta o nombre libre, ingredientes consumidos, notas, calorías y consumo. |
| Mapping de ingrediente confirmado | `public.ingredient_mappings` | mismo mapping de usuario; ruta completa cuando exista | Solo entra si es canónico o el usuario lo confirmó. Los candidatos fuzzy/LLM sin confirmar se descartan por ser caché. |
| WatermelonDB `recipe_cache` | No se migra | No aplica | Caché reconstruible a partir del catálogo. |

Los imports hacen upsert por `(user_id, source, legacy_id)` cuando `legacy_id` existe. Las filas creadas por la aplicación pueden dejarlo nulo y usar su UUID preasignado. Los borrados importados se representan con `deleted_at`; nunca se pierde la referencia al origen. `version` empieza en 1 y se incrementará en operaciones de sincronización posteriores.
