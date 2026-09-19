# Esquema de dominio canónico

Las tablas autoritativas de Sprint 2 son `inventory_items`, `receipt_drafts`, `favorite_recipes`, `meal_entries` e `ingredient_mappings`. Todas pertenecen a un usuario, conservan `source`/`legacy_id`, usan UUID estable y mantienen tombstones mediante `deleted_at`.

`recipe_cache` no se migra: es una caché reconstruible. Los mappings no verificados tampoco son autoridad; `ingredient_mappings` exige que cada fila sea canónica o esté verificada por el usuario.

## Seed de catálogo

El seed `catalog-v1` contiene 5 ingredientes canónicos (`butter`, `chicken`, `milk`, `salt`, `tomato`) ordenados por slug. Su checksum reproducible se obtiene con:

```sql
select md5(string_agg(slug || ':' || name || ':' || category || ':' || synonyms::text, '|' order by slug))
from public.ingredients where seed_version = 'catalog-v1';
```

El seed usa upsert por `slug`: repetirlo mantiene cardinalidad 5 y el checksum `17c09ec4416555986ff0537703576daa`.
