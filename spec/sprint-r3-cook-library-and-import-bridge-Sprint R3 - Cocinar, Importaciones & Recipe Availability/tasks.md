# sprint-r3-cook-library-and-import-bridge · Sprint R3 - Cocinar, Importaciones & Recipe Availability — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [x] (T1) Con PRODUCT_V3=true, /app/cook ofrece Para hoy, Guardadas e Importadas y Traer receta; view inválida usa today; navegación legacy y deep links permanecen funcionales.  ↔ R1
- [x] (T2) Biblioteca combina catálogo activo y recetas privadas válidas sin publicar importaciones en el catálogo global ni exponer datos de otro usuario; identidad RecipeRef estable por origen.  ↔ R2
- [x] (T3) Listados paginados cumplen cook-library-v1, limit 1..50/default20 y orden definido; cursor inválido devuelve 400; no hay duplicados entre páginas de la misma versión.  ↔ R3
- [x] (T4) Imports pendientes/fallidos/completados se recuperan tras recarga mediante polling existente; Enlace/Texto/Archivo usan pipeline, límites y reserva de cuota actuales.  ↔ R4
- [x] (T5) Completed se valida antes de proyectar receta; resultado inválido muestra error recuperable y bloquea guardar/compra sin mutar el job histórico.  ↔ R5
- [x] (T6) Cada ingrediente proyectado tiene amount_status exact o unknown; exact exige evidencia, cantidad positiva y unidad compatible con parser R2; unknown lleva amount_value y amount_unit null y conserva texto original.  ↔ R6
- [x] (T7) Nunca se fabrica amount_value=1 ni otra cantidad ausente. UI muestra Cantidad no indicada o Cantidad por comprobar según evidencia, incluyendo legacy.  ↔ R7
- [x] (T8) RecipeAvailability reutiliza evaluateTodayRecipe y estados R2 sin cambiar la semántica de Hoy; alias ambiguo/no resuelto queda unknown, nunca match por string comercial aproximado.  ↔ R8
- [x] (T9) Disponibilidad agrupa conceptos repetidos, suma medidas compatibles sin doble contabilizar stock; excluye tombstone/empty/0 y respeta precisión independiente de cantidad/frescura.  ↔ R9
- [x] (T10) Tienes N de M cuenta grupos semánticos y desconocidos según diseño; N no afirma suficiencia cuando solo hay presencia. Fixture de dos grupos presentes de cuatro produce 2/4.  ↔ R10
- [x] (T11) Resultado diferencia suficiente, presencia con cantidad por comprobar, faltante demostrado y concepto por comprobar; unknown nunca se añade automáticamente a Compra.  ↔ R11
- [x] (T12) Para hoy ordena con ranking R2; Puedes hacerlo ahora solo ready; Te falta poco solo missing_one sin unknown ni cantidad por comprobar; otras situaciones conservan etiquetas honestas.  ↔ R12
- [x] (T13) GET availability cumple recipe-availability-v1 e incluye snapshot privado, revisión vigente, posiciones y decisiones por grupo; TTL <=60 min e invalidación por despensa, receta/conceptos/motor.  ↔ R13
- [x] (T14) Revisión aceptada modifica la proyección vigente e invalida cache; no reescribe el job original, provenance ni snapshot de favorito guardado.  ↔ R14
- [x] (T15) Review_required conserva aviso en detalle y favorito; comparación se rotula provisional; compra requiere confirmación explícita del aviso además de faltantes.  ↔ R15
- [x] (T16) Compra recibe solo RecipeRef/snapshotKey/clientMutationId; servidor verifica ownership y snapshot y recalcula todos los faltantes dentro de transacción, sin cantidades del cliente.  ↔ R16
- [x] (T17) Compra crea/deduplica shopping_items activos por usuario, origen de receta y concepto/unidad compatible, source=recipe_missing y source_ref estable que distingue catalog/import; no fusiona orígenes ni sobrescribe compra manual.  ↔ R17
- [x] (T18) Déficit sin cantidad verificable crea faltante sin cantidad inventada; déficit exacto usa cantidad/unidad R2. Si no hay faltantes no se escriben items y CTA está deshabilitado.  ↔ R18
- [x] (T19) Replay de compra conserva IDs/resultado y precede a validar estado nuevo; concurrencia no duplica items; mismo mutationId con payload distinto devuelve 409 sin escritura parcial.  ↔ R19
- [x] (T20) Snapshot obsoleto/ajeno y receta inválida no escriben compra; conflicto exige recargar/reconfirmar con ID nuevo; fallo de red conserva ID del intento.  ↔ R20
- [x] (T21) Guardar en Cocinar resuelve receta autoritativa y persiste snapshot inmutable; doble clic/retry/concurrencia no duplica favorito activo; import no necesita recipe_id de catálogo ficticio.  ↔ R21
- [x] (T22) Guardar misma receta ya activa devuelve su identidad estable sin sobrescribir snapshot; versión de receta obsoleta devuelve RECIPE_CONFLICT; quitar y volver a guardar conserva semántica legacy.  ↔ R22
- [x] (T23) Original solo ofrece URL http/https válida sin credenciales con apertura segura; fuente manual/file sin URL oculta CTA; no usa URL externa como returnTo interno.  ↔ R23
- [x] (T24) Failed traduce códigos técnicos a mensajes útiles; WHISPER_REJECTED ofrece Pegar receta como texto; retry elegible reutiliza job y cuota y no reencola automáticamente históricos.  ↔ R24
- [x] (T25) Retry endpoint autentica propietario, verifica retryable y fuente disponible; deduplica concurrencia y deja polling recuperable ante QUEUE_UNAVAILABLE; no consume nueva importación.  ↔ R25
- [x] (T26) Loading/vacío/error/offline/sesión caducada son distintos; offline muestra solo lectura anterior fechada del usuario actual y bloquea compra/guardar/retry/upload.  ↔ R26
- [x] (T27) Logout/cambio de cuenta cancela respuestas pendientes y oculta datos previos; RLS y 404 uniforme impiden inferir jobs, favoritos y snapshots ajenos.  ↔ R27
- [x] (T28) Contratos cook validan JSON estricto y Origin, respuestas private no-store sin cache SW; logs excluyen contenido privado y secretos; endpoints v2 mantienen sus contratos.  ↔ R28
- [x] (T29) Deep links Hoy→detalle e import→Compra funcionan; acceso desde guardada a calendario usa ruta legacy y parámetros seguros, sin implementar planificación R6.  ↔ R29
- [x] (T30) Flag PRODUCT_V3=false conserva navegación/motor/cuota v2 y fixes R1/R2; APIs cook nuevas 404; flags import independientes no se activan automáticamente.  ↔ R30
- [x] (T31) No se reduce la protección de evidencia/review_required de improve-recipe-import-quality; benchmark humano y smoke Whisper/GCS no verificados permanecen documentados y bloquean activación general.  ↔ R31
- [x] (T32) Playwright verifica URL/manual/archivo, 2/4, unknown, guardar/compra/replay/conflicto, fallo recuperable, aislamiento/offline y rollback; capturas localhost 320/393 comparadas con 05/07, foco/44px/movimiento reducido.  ↔ R32
- [x] (T33) Pasan gates harness, domain typecheck/tests, build, DB lint/pgTAP y suites de worker/Python afectadas; migraciones locales aditivas sin reset. Install frozen obligatorio si cambia lockfile.  ↔ R33
- [x] Tests que cubran los criterios de aceptación
