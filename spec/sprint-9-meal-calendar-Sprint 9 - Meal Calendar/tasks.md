# sprint-9-meal-calendar · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [ ] (T1) Una meal_entry usa un UUID estable generado por el cliente, pertenece al usuario autenticado y admite múltiples entradas para el mismo meal_date.  ↔ R1
- [ ] (T2) meal_date se almacena y transmite exclusivamente como fecha civil YYYY-MM-DD, sin convertirla a instante UTC; pruebas en zonas con y sin DST conservan el día elegido al crear, editar, recargar y sincronizar.  ↔ R2
- [ ] (T3) recipe_id es nullable y su foreign key usa ON DELETE SET NULL; borrar una receta no elimina ni vuelve ilegible la comida histórica.  ↔ R3
- [ ] (T4) Cada comida conserva un snapshot versionado suficiente para mostrar su nombre histórico y auditar ingredients_consumed, incluyendo identificadores o nombres, cantidades, unidades y referencias de inventario/ledger cuando existan.  ↔ R4
- [ ] (T5) Create, update y delete usan client_mutation_id UUID; UNIQUE(user_id, client_mutation_id) persiste y reproduce el resultado canónico, de modo que replays y respuestas perdidas no crean duplicados.  ↔ R5
- [ ] (T6) Update y delete exigen expected_version positiva; una versión obsoleta devuelve conflict con la fila canónica y no modifica datos. Cada escritura aplicada incrementa version exactamente una vez.  ↔ R6
- [ ] (T7) Delete crea un tombstone mediante deleted_at y participa en el pull incremental; la reconexión converge create, update y delete respetando orden causal por meal_entry.  ↔ R7
- [ ] (T8) La outbox y caché IndexedDB están particionadas por user_id; logout detiene la sincronización y evita que otro usuario vea o procese datos locales ajenos.  ↔ R8
- [ ] (T9) Create seguido de delete antes de cualquier envío se elimina localmente; si el create pudo alcanzar el servidor, se reconcilia y se envía un delete idempotente independiente.  ↔ R9
- [ ] (T10) Las RPC derivan user_id únicamente de auth.uid(), no aceptan ownership autoritativo del cliente y RLS impide select, insert, update y delete entre dos usuarios distintos.  ↔ R10
- [ ] (T11) La vista mensual muestra loading, vacío, caché offline fechada, pending, synced, conflict, error recuperable y sesión expirada con texto accesible y navegación por teclado.  ↔ R11
- [ ] (T12) El alta custom y el alta desde receta funcionan online y offline; las mutaciones optimistas no se presentan como confirmadas antes de obtener el resultado canónico.  ↔ R12
- [ ] (T13) Un conflicto conserva el borrador local, muestra la versión canónica y permite descartarlo o revisarlo y reintentarlo mediante un nuevo client_mutation_id basado en la versión remota.  ↔ R13
- [ ] (T14) El detalle sigue siendo legible si la receta fue eliminada y permite borrar la comida con confirmación; un borrado pendiente o en conflicto se distingue visualmente de uno confirmado.  ↔ R14
- [ ] (T15) Las migraciones SQL e IndexedDB son aditivas y versionadas; el rollback por deployment o feature flag conserva comidas, snapshots, tombstones y mutaciones y mantiene compatibles los contratos de Sprint 8.  ↔ R15
- [ ] (T16) Pruebas unitarias cubren fecha civil, DST, compactación y orden de outbox; pgTAP/integración cubren RLS, constraints, idempotencia, CAS y atomicidad; Playwright cubre mes, alta custom, alta desde receta, detalle, delete, offline, recarga y reconexión con dos dispositivos.  ↔ R16
- [ ] (T17) Lint, typecheck, tests unitarios, pruebas Supabase y E2E pasan sin depender de secretos o servicios de producción.  ↔ R17
- [ ] Tests que cubran los criterios de aceptación
