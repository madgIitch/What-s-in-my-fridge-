# sprint-9-meal-calendar · undefined — Requisitos

- name: `Sprint 9 - Meal Calendar` · priority: P1 · sdd: true
- aprobado por: peorr · 2026-09-21T20:43:49.961Z

## Contexto



## Requisitos funcionales

R1. Una meal_entry usa un UUID estable generado por el cliente, pertenece al usuario autenticado y admite múltiples entradas para el mismo meal_date.
R2. meal_date se almacena y transmite exclusivamente como fecha civil YYYY-MM-DD, sin convertirla a instante UTC; pruebas en zonas con y sin DST conservan el día elegido al crear, editar, recargar y sincronizar.
R3. recipe_id es nullable y su foreign key usa ON DELETE SET NULL; borrar una receta no elimina ni vuelve ilegible la comida histórica.
R4. Cada comida conserva un snapshot versionado suficiente para mostrar su nombre histórico y auditar ingredients_consumed, incluyendo identificadores o nombres, cantidades, unidades y referencias de inventario/ledger cuando existan.
R5. Create, update y delete usan client_mutation_id UUID; UNIQUE(user_id, client_mutation_id) persiste y reproduce el resultado canónico, de modo que replays y respuestas perdidas no crean duplicados.
R6. Update y delete exigen expected_version positiva; una versión obsoleta devuelve conflict con la fila canónica y no modifica datos. Cada escritura aplicada incrementa version exactamente una vez.
R7. Delete crea un tombstone mediante deleted_at y participa en el pull incremental; la reconexión converge create, update y delete respetando orden causal por meal_entry.
R8. La outbox y caché IndexedDB están particionadas por user_id; logout detiene la sincronización y evita que otro usuario vea o procese datos locales ajenos.
R9. Create seguido de delete antes de cualquier envío se elimina localmente; si el create pudo alcanzar el servidor, se reconcilia y se envía un delete idempotente independiente.
R10. Las RPC derivan user_id únicamente de auth.uid(), no aceptan ownership autoritativo del cliente y RLS impide select, insert, update y delete entre dos usuarios distintos.
R11. La vista mensual muestra loading, vacío, caché offline fechada, pending, synced, conflict, error recuperable y sesión expirada con texto accesible y navegación por teclado.
R12. El alta custom y el alta desde receta funcionan online y offline; las mutaciones optimistas no se presentan como confirmadas antes de obtener el resultado canónico.
R13. Un conflicto conserva el borrador local, muestra la versión canónica y permite descartarlo o revisarlo y reintentarlo mediante un nuevo client_mutation_id basado en la versión remota.
R14. El detalle sigue siendo legible si la receta fue eliminada y permite borrar la comida con confirmación; un borrado pendiente o en conflicto se distingue visualmente de uno confirmado.
R15. Las migraciones SQL e IndexedDB son aditivas y versionadas; el rollback por deployment o feature flag conserva comidas, snapshots, tombstones y mutaciones y mantiene compatibles los contratos de Sprint 8.
R16. Pruebas unitarias cubren fecha civil, DST, compactación y orden de outbox; pgTAP/integración cubren RLS, constraints, idempotencia, CAS y atomicidad; Playwright cubre mes, alta custom, alta desde receta, detalle, delete, offline, recarga y reconexión con dos dispositivos.
R17. Lint, typecheck, tests unitarios, pruebas Supabase y E2E pasan sin depender de secretos o servicios de producción.

## Restricciones

- **error_states:** El contrato distingue `applied`, `duplicate`, `conflict` y `rejected`, con códigos estables. Solo red, timeout y 5xx se reintentan automáticamente; los errores de validación exigen corregir campos. `duplicate` reproduce el primer resultado canónico sin ejecutar otra escritura aunque cambien operación o payload; el ledger conserva el hash para auditoría sin revelar el payload anterior. Una versión obsoleta produce conflicto visible. Update sobre tombstone devuelve `conflict/ALREADY_DELETED` con el tombstone canónico; un delete nuevo sobre tombstone devuelve `applied/ALREADY_DELETED` sin cambiar `version` ni `updated_at`; cualquier operación sobre un id nunca creado devuelve `rejected/NOT_FOUND` y `result:null`. Un 401 pausa la outbox y redirige al login con un `returnTo` allowlisted.
- **auth_secrets:** Las RPC derivan ownership exclusivamente de `auth.uid()`, no aceptan un `user_id` autoritativo del cliente y RLS aísla select, insert, update y delete entre usuarios. Caché, borradores, cursores, ledger y outbox se particionan por usuario. Logout detiene la sincronización y evita exposición o procesamiento cruzado. El navegador solo usa la clave publishable/anon y la service role permanece exclusivamente server-side.
- **rollback_compat:** Las migraciones SQL e IndexedDB son aditivas y versionadas. El rollback se limita a deployment o feature flag y conserva filas, snapshots, tombstones, borradores, cursores, ledgers y mutaciones. No rompe el contrato de cocina de Sprint 8 ni los clientes legacy que ignoren los campos o stores nuevos.

