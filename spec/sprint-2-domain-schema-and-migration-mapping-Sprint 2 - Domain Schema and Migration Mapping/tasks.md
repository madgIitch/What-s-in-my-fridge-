# sprint-2-domain-schema-and-migration-mapping · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [ ] (T1) Cada tabla privada referencia `auth.users(id)` directamente o una relación privada cuyo acceso deriva inequívocamente del owner, y tiene RLS habilitado.  ↔ R1
- [ ] (T2) `inventory_items` conserva name, normalized_name, expiry_date, category, quantity, notes, unit, added_at y source; su UUID puede generarse antes de sincronizar y permanece estable.  ↔ R2
- [ ] (T3) `receipt_drafts` conserva raw text, merchant, purchase date, currency, total, líneas, unrecognized lines y confirmed sin depender de una imagen permanente.  ↔ R3
- [ ] (T4) `favorite_recipes` conserva un snapshot histórico de nombre, match, ingredientes e instrucciones aunque cambie el catálogo.  ↔ R4
- [ ] (T5) `meal_entries` conserva meal type/date, recipe opcional o custom name, ingredientes consumidos, notes, calories estimate nullable y consumed_at.  ↔ R5
- [ ] (T6) `recipe_cache` no existe como tabla autoritativa migrada y queda documentada como caché reconstruible.  ↔ R6
- [ ] (T7) `ingredient_mappings` solo persiste mappings canónicos o verificados por usuario; entradas no verificadas no son autoridad y pueden regenerarse.  ↔ R7
- [ ] (T8) Cada entidad importable conserva source y legacy_id con una constraint única suficiente para que reimportar el mismo documento actualice o identifique la misma fila sin duplicarla.  ↔ R8
- [ ] (T9) Las eliminaciones sincronizables usan `deleted_at` y no eliminan silenciosamente la trazabilidad legacy durante la migración.  ↔ R9
- [ ] (T10) Tests pgTAP con dos usuarios demuestran aislamiento SELECT/INSERT/UPDATE/DELETE para todas las tablas privadas nuevas y validan constraints críticas.  ↔ R10
- [ ] (T11) Los tipos de dominio representan filas, inserts y payloads legacy sin dependencias de React, Next.js, Firebase o Supabase client.  ↔ R11
- [ ] (T12) Los seeds del catálogo son reejecutables, no duplican filas y producen cardinalidad y checksum documentados y comprobables.  ↔ R12
- [ ] Tests que cubran los criterios de aceptación
