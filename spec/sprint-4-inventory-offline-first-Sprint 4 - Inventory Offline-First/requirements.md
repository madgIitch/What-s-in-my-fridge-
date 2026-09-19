# sprint-4-inventory-offline-first · undefined — Requisitos

- name: `Sprint 4 - Inventory Offline-First` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-19T10:42:40.921Z

## Contexto



## Requisitos funcionales

R1. Crear un item sin red genera antes de renderizar un UUID de cliente, lo muestra con texto pending, persiste item y mutación en IndexedDB en una sola transacción y, tras recargar todavía offline, conserva ambos.
R2. Al recuperar la red, una única mutación create se aplica en Supabase, conserva exactamente el UUID local, devuelve la fila canónica y cambia el estado visible a synced.
R3. El servidor aplica cada mutación atómicamente y UNIQUE(user_id, client_mutation_id) garantiza que repetirla devuelve el mismo resultado sin crear ni aplicar una segunda fila.
R4. Update y delete requieren expected_version; si no coincide con la versión activa del servidor, no modifican la fila y devuelven el código estable SYNC_CONFLICT junto con la versión remota actual.
R5. Un update confirmado incrementa version exactamente en uno y actualiza updated_at en UTC; ningún cliente puede asignar directamente una versión arbitraria.
R6. Un delete offline fija un tombstone local, oculta inmediatamente el item de la lista activa y encola delete; su reintento deja un único tombstone servidor con deleted_at UTC y resultado idempotente.
R7. Las mutaciones pendientes se procesan en orden causal por item; fallos reintentables conservan la outbox y usan backoff acotado, mientras conflict y errores permanentes quedan visibles con texto y una acción explícita.
R8. Dos pestañas del mismo usuario comparten el estado persistido, evitan aplicar concurrentemente la misma mutación y convergen a la misma fila y estado tras recibir o consultar cambios.
R9. Cerrar sesión impide mostrar la caché privada del usuario anterior; iniciar sesión como otro usuario usa un espacio IndexedDB aislado y no procesa la outbox ajena.
R10. expiry_date se persiste como fecha civil YYYY-MM-DD; timestamps técnicos se guardan como ISO UTC y la presentación en cualquier zona soportada mantiene el día de caducidad elegido.
R11. Las lecturas y mutaciones directas con una sesión del usuario A no pueden observar, insertar, actualizar ni borrar inventory_items o client_mutations del usuario B; pgTAP verifica las cuatro operaciones.
R12. La PWA de inventario usa exclusivamente Dexie/IndexedDB como réplica local y Supabase como autoridad servidor; una comprobación automatizada impide imports de WatermelonDB, Firestore o Firebase en apps/web.
R13. La UI representa loading, vacío, offline sin caché, synced, pending, conflict y error mediante texto accesible, no únicamente color, y funciona sin desbordamiento horizontal a 320 px.
R14. Playwright contra Supabase local cubre CRUD online, create/update/delete offline, recarga offline, reconexión, reintento idempotente, conflicto por expected_version, dos pestañas, aislamiento entre usuarios y viewport de 320 px con aserciones sobre UI, IndexedDB y filas servidor.
R15. Las migraciones son aditivas, no modifican destructivamente Firebase, WatermelonDB ni el cliente Expo, y la reversión de despliegue web no elimina outbox, caché o tombstones existentes.

## Restricciones

- **error_states:** NETWORK_ERROR, timeout y 5xx son reintentables con backoff exponencial y jitter, hasta 5 intentos automáticos por sesión de sincronización y máximo de 30 segundos. AUTH_REQUIRED pausa toda la cola; FORBIDDEN y VALIDATION_ERROR son permanentes; SYNC_CONFLICT requiere resolución explícita. Las mutaciones agotadas quedan en error y pueden reintentarse manualmente o durante una reconexión posterior; ningún fallo elimina la mutación local.
- **auth_secrets:** La sesión Supabase y RLS basada en auth.uid() aíslan todos los datos. El RPC deriva user_id exclusivamente de auth.uid() y no acepta ownership suministrado por el cliente. La publishable/anon key puede ser pública y la service role permanece exclusivamente server-only. pgTAP verifica que un usuario no puede observar ni mutar inventory_items o client_mutations ajenos.
- **rollback_compat:** Los cambios SQL e IndexedDB son aditivos y Firebase, WatermelonDB y Expo permanecen intactos. Los stores y campos nuevos se versionan para que una PWA anterior pueda ignorarlos sin eliminar caché, outbox ni tombstones. El logout desvincula los datos locales de la UI y del worker; otro usuario no puede verlos ni procesarlos. La purga local y la compactación de tombstones quedan fuera de este sprint y requieren políticas posteriores aprobadas.

