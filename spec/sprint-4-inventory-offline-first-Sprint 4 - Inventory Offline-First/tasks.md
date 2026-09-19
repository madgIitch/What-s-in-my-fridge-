# sprint-4-inventory-offline-first · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [ ] (T1) Crear un item sin red genera antes de renderizar un UUID de cliente, lo muestra con texto pending, persiste item y mutación en IndexedDB en una sola transacción y, tras recargar todavía offline, conserva ambos.  ↔ R1
- [ ] (T2) Al recuperar la red, una única mutación create se aplica en Supabase, conserva exactamente el UUID local, devuelve la fila canónica y cambia el estado visible a synced.  ↔ R2
- [ ] (T3) El servidor aplica cada mutación atómicamente y UNIQUE(user_id, client_mutation_id) garantiza que repetirla devuelve el mismo resultado sin crear ni aplicar una segunda fila.  ↔ R3
- [ ] (T4) Update y delete requieren expected_version; si no coincide con la versión activa del servidor, no modifican la fila y devuelven el código estable SYNC_CONFLICT junto con la versión remota actual.  ↔ R4
- [ ] (T5) Un update confirmado incrementa version exactamente en uno y actualiza updated_at en UTC; ningún cliente puede asignar directamente una versión arbitraria.  ↔ R5
- [ ] (T6) Un delete offline fija un tombstone local, oculta inmediatamente el item de la lista activa y encola delete; su reintento deja un único tombstone servidor con deleted_at UTC y resultado idempotente.  ↔ R6
- [ ] (T7) Las mutaciones pendientes se procesan en orden causal por item; fallos reintentables conservan la outbox y usan backoff acotado, mientras conflict y errores permanentes quedan visibles con texto y una acción explícita.  ↔ R7
- [ ] (T8) Dos pestañas del mismo usuario comparten el estado persistido, evitan aplicar concurrentemente la misma mutación y convergen a la misma fila y estado tras recibir o consultar cambios.  ↔ R8
- [ ] (T9) Cerrar sesión impide mostrar la caché privada del usuario anterior; iniciar sesión como otro usuario usa un espacio IndexedDB aislado y no procesa la outbox ajena.  ↔ R9
- [ ] (T10) expiry_date se persiste como fecha civil YYYY-MM-DD; timestamps técnicos se guardan como ISO UTC y la presentación en cualquier zona soportada mantiene el día de caducidad elegido.  ↔ R10
- [ ] (T11) Las lecturas y mutaciones directas con una sesión del usuario A no pueden observar, insertar, actualizar ni borrar inventory_items o client_mutations del usuario B; pgTAP verifica las cuatro operaciones.  ↔ R11
- [ ] (T12) La PWA de inventario usa exclusivamente Dexie/IndexedDB como réplica local y Supabase como autoridad servidor; una comprobación automatizada impide imports de WatermelonDB, Firestore o Firebase en apps/web.  ↔ R12
- [ ] (T13) La UI representa loading, vacío, offline sin caché, synced, pending, conflict y error mediante texto accesible, no únicamente color, y funciona sin desbordamiento horizontal a 320 px.  ↔ R13
- [ ] (T14) Playwright contra Supabase local cubre CRUD online, create/update/delete offline, recarga offline, reconexión, reintento idempotente, conflicto por expected_version, dos pestañas, aislamiento entre usuarios y viewport de 320 px con aserciones sobre UI, IndexedDB y filas servidor.  ↔ R14
- [ ] (T15) Las migraciones son aditivas, no modifican destructivamente Firebase, WatermelonDB ni el cliente Expo, y la reversión de despliegue web no elimina outbox, caché o tombstones existentes.  ↔ R15
- [ ] Tests que cubran los criterios de aceptación
