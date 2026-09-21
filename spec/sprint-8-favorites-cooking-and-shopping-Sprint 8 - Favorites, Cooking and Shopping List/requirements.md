# sprint-8-favorites-cooking-and-shopping · undefined — Requisitos

- name: `Sprint 8 - Favorites, Cooking and Shopping List` · priority: P1 · sdd: true
- aprobado por: peorr · 2026-09-21T17:37:25.362Z

## Contexto



## Requisitos funcionales

R1. Existe como máximo un favorito activo por (user_id, recipe_id); guardar o quitar repetidamente con el mismo estado objetivo devuelve éxito canónico y no crea duplicados.
R2. Al guardar un favorito se persiste un snapshot completo y versionado de título, ingredientes e instrucciones; el snapshot permanece legible tras reload y offline una vez sincronizado, aunque cambien el catálogo, el match de inventario o la receta de origen.
R3. La UI calcula de nuevo disponibilidad y missing ingredients contra el inventario actual sin modificar el snapshot guardado.
R4. Cocinar se aplica mediante una única transacción autenticada que bloquea o compara versiones de todos los inventory_items afectados, valida unidades y cantidades antes de escribir y no realiza cambios parciales si algún elemento entra en conflicto.
R5. Ninguna aplicación exitosa deja quantity menor que cero; cantidades insuficientes o versiones obsoletas producen un conflicto estable con el inventario canónico y no registran el consumo como confirmado.
R6. Cada intento de cocinar utiliza un client_mutation_id UUID único por intención; UNIQUE(user_id, client_mutation_id) garantiza que un replay devuelve el primer resultado canónico sin volver a descontar.
R7. Las operaciones pendientes creadas offline no se muestran como confirmadas; cocinar queda pendiente hasta validación servidor y, si es rechazado, conserva datos suficientes para explicar y resolver el conflicto.
R8. La lista de compra puede derivarse de missing ingredients del snapshot actual y admitir selección explícita; la deduplicación y agregación solo combinan cantidades con ingrediente y unidad compatibles.
R9. Favoritos, consumos, mutaciones y elementos de compra derivan ownership exclusivamente de auth.uid() y están protegidos por RLS; un usuario no puede leer, inferir ni modificar filas de otro usuario.
R10. Los RPC devuelven estados applied, duplicate, conflict o rejected y códigos estables; duplicate reproduce el resultado almacenado de la primera ejecución.
R11. Logout impide que la UI y el worker de sincronización muestren o procesen la caché y outbox del usuario anterior.
R12. Los cambios de base de datos e IndexedDB son aditivos y versionados; no alteran destructivamente Firebase, WatermelonDB ni el cliente Expo, y un rollback de deployment conserva los datos creados.
R13. Tests unitarios cubren snapshots, missing ingredients, agregación por unidades, cantidades límite y reducción de outbox; pgTAP cubre RLS con dos usuarios, constraints, transacción atómica, concurrencia e idempotencia.
R14. Playwright con Supabase local cubre guardar y quitar favorito, reload offline del favorito, cocinar con éxito, replay del mismo mutation id, conflicto por cantidad/versión, lista derivada y explícita, aislamiento entre usuarios y navegación completa en viewport de 320 px.

## Restricciones

- **error_states:** Se definen respuestas terminales `applied|duplicate|conflict|rejected`, sin éxitos parciales, y códigos estables: `VERSION_CONFLICT`, `INSUFFICIENT_QUANTITY`, `UNIT_INCOMPATIBLE`, `INGREDIENT_UNMAPPED`, `RECIPE_UNAVAILABLE`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `DUPLICATE` y `NETWORK_PENDING`. Solo los fallos transitorios se reintentan automáticamente; los conflictos incluyen estado canónico para revisión y los rechazos exigen corregir el payload.
- **auth_secrets:** Todas las tablas privadas activan RLS basada en `auth.uid()` y las RPC derivan el propietario exclusivamente de la sesión; ningún `user_id` aportado por el cliente es autoritativo. El navegador solo recibe la URL y clave publishable/anon de Supabase. Service role y demás secretos permanecen server-side y no aparecen en bundles, IndexedDB, respuestas ni logs.
- **rollback_compat:** El rollback se limita al deployment o feature flag. Las migraciones SQL e IndexedDB son aditivas y versionadas, conservan snapshots, mutaciones, tombstones y datos legacy, y no usan down migrations destructivas. No se modifica Expo/Firebase y una PWA anterior puede seguir usando sus contratos existentes aunque ignore las tablas o campos nuevos.

