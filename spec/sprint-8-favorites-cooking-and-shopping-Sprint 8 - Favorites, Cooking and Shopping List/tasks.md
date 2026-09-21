# sprint-8-favorites-cooking-and-shopping · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [x] (T1) Existe como máximo un favorito activo por (user_id, recipe_id); guardar o quitar repetidamente con el mismo estado objetivo devuelve éxito canónico y no crea duplicados.  ↔ R1
- [x] (T2) Al guardar un favorito se persiste un snapshot completo y versionado de título, ingredientes e instrucciones; el snapshot permanece legible tras reload y offline una vez sincronizado, aunque cambien el catálogo, el match de inventario o la receta de origen.  ↔ R2
- [x] (T3) La UI calcula de nuevo disponibilidad y missing ingredients contra el inventario actual sin modificar el snapshot guardado.  ↔ R3
- [x] (T4) Cocinar se aplica mediante una única transacción autenticada que bloquea o compara versiones de todos los inventory_items afectados, valida unidades y cantidades antes de escribir y no realiza cambios parciales si algún elemento entra en conflicto.  ↔ R4
- [x] (T5) Ninguna aplicación exitosa deja quantity menor que cero; cantidades insuficientes o versiones obsoletas producen un conflicto estable con el inventario canónico y no registran el consumo como confirmado.  ↔ R5
- [x] (T6) Cada intento de cocinar utiliza un client_mutation_id UUID único por intención; UNIQUE(user_id, client_mutation_id) garantiza que un replay devuelve el primer resultado canónico sin volver a descontar.  ↔ R6
- [x] (T7) Las operaciones pendientes creadas offline no se muestran como confirmadas; cocinar queda pendiente hasta validación servidor y, si es rechazado, conserva datos suficientes para explicar y resolver el conflicto.  ↔ R7
- [x] (T8) La lista de compra puede derivarse de missing ingredients del snapshot actual y admitir selección explícita; la deduplicación y agregación solo combinan cantidades con ingrediente y unidad compatibles.  ↔ R8
- [x] (T9) Favoritos, consumos, mutaciones y elementos de compra derivan ownership exclusivamente de auth.uid() y están protegidos por RLS; un usuario no puede leer, inferir ni modificar filas de otro usuario.  ↔ R9
- [x] (T10) Los RPC devuelven estados applied, duplicate, conflict o rejected y códigos estables; duplicate reproduce el resultado almacenado de la primera ejecución.  ↔ R10
- [x] (T11) Logout impide que la UI y el worker de sincronización muestren o procesen la caché y outbox del usuario anterior.  ↔ R11
- [x] (T12) Los cambios de base de datos e IndexedDB son aditivos y versionados; no alteran destructivamente Firebase, WatermelonDB ni el cliente Expo, y un rollback de deployment conserva los datos creados.  ↔ R12
- [x] (T13) Tests unitarios cubren snapshots, missing ingredients, agregación por unidades, cantidades límite y reducción de outbox; pgTAP cubre RLS con dos usuarios, constraints, transacción atómica, concurrencia e idempotencia.  ↔ R13
- [x] (T14) Playwright con Supabase local cubre guardar y quitar favorito, reload offline del favorito, cocinar con éxito, replay del mismo mutation id, conflicto por cantidad/versión, lista derivada y explícita, aislamiento entre usuarios y navegación completa en viewport de 320 px.  ↔ R14
- [x] Tests que cubran los criterios de aceptación
