# sprint-2-domain-schema-and-migration-mapping · undefined — Requisitos

- name: `Sprint 2 - Domain Schema and Migration Mapping` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-19T09:41:33.902Z

## Contexto



## Requisitos funcionales

R1. Cada tabla privada referencia `auth.users(id)` directamente o una relación privada cuyo acceso deriva inequívocamente del owner, y tiene RLS habilitado.
R2. `inventory_items` conserva name, normalized_name, expiry_date, category, quantity, notes, unit, added_at y source; su UUID puede generarse antes de sincronizar y permanece estable.
R3. `receipt_drafts` conserva raw text, merchant, purchase date, currency, total, líneas, unrecognized lines y confirmed sin depender de una imagen permanente.
R4. `favorite_recipes` conserva un snapshot histórico de nombre, match, ingredientes e instrucciones aunque cambie el catálogo.
R5. `meal_entries` conserva meal type/date, recipe opcional o custom name, ingredientes consumidos, notes, calories estimate nullable y consumed_at.
R6. `recipe_cache` no existe como tabla autoritativa migrada y queda documentada como caché reconstruible.
R7. `ingredient_mappings` solo persiste mappings canónicos o verificados por usuario; entradas no verificadas no son autoridad y pueden regenerarse.
R8. Cada entidad importable conserva source y legacy_id con una constraint única suficiente para que reimportar el mismo documento actualice o identifique la misma fila sin duplicarla.
R9. Las eliminaciones sincronizables usan `deleted_at` y no eliminan silenciosamente la trazabilidad legacy durante la migración.
R10. Tests pgTAP con dos usuarios demuestran aislamiento SELECT/INSERT/UPDATE/DELETE para todas las tablas privadas nuevas y validan constraints críticas.
R11. Los tipos de dominio representan filas, inserts y payloads legacy sin dependencias de React, Next.js, Firebase o Supabase client.
R12. Los seeds del catálogo son reejecutables, no duplican filas y producen cardinalidad y checksum documentados y comprobables.

## Restricciones

- **error_states:** Constraints rechazan ownership inválido, referencias rotas, estados incoherentes y duplicados legacy; los importadores futuros deberán enviar inválidos a quarantine en lugar de descartarlos.
- **auth_secrets:** Todas las tablas privadas derivan acceso de auth.uid() mediante RLS; el schema y seeds no requieren ni exponen service role al navegador.
- **rollback_compat:** Migración aditiva, sin modificar ni retirar Firebase o el cliente móvil; cachés no autoritativas se reconstruyen y los registros importados conservan source/legacy_id.

