# R3 · Cocinar, importaciones y disponibilidad

Estado: spec_ready, pendiente de aprobación. Preparado el 8 de octubre de 2026.

## Objetivo

Unificar catálogo, guardadas e importadas en Cocinar y convertir cada receta importada en una comparación inmediata contra la despensa.

## Scope propuesto

- `apps/web/src/app/(auth)/app/cook/**`
- `apps/web/src/app/(auth)/app/recipes/**`
- `apps/web/src/app/api/cook/**`
- `apps/web/src/app/api/recipe-jobs/**`
- `apps/web/src/app/api/favorites/**`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/cook/**`
- `apps/web/src/components/recipe-import/**`
- `apps/web/src/components/favorites/**`
- `apps/web/src/lib/cook/**`
- `apps/web/src/lib/recipe-import/**`
- `apps/web/src/lib/recipes/**`
- `apps/web/src/lib/favorites/**`
- `apps/web/src/types/database.generated.ts`
- `packages/domain/src/recipes/**`
- `packages/domain/src/recipe-jobs/**`
- `packages/domain/src/favorites/**`
- `services/media-worker/**`
- `whats-in-my-fridge-backend/whisper_api.py`
- `whats-in-my-fridge-backend/tests/test_whisper_upload.py`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/**`
- `docs/**`
- `spec.json`

## Acceptance propuesto

1. Con PRODUCT_V3=true, /app/cook ofrece Para hoy, Guardadas e Importadas y Traer receta; view inválida usa today; navegación legacy y deep links permanecen funcionales.
2. Biblioteca combina catálogo activo y recetas privadas válidas sin publicar importaciones en el catálogo global ni exponer datos de otro usuario; identidad RecipeRef estable por origen.
3. Listados paginados cumplen cook-library-v1, limit 1..50/default20 y orden definido; cursor inválido devuelve 400; no hay duplicados entre páginas de la misma versión.
4. Imports pendientes/fallidos/completados se recuperan tras recarga mediante polling existente; Enlace/Texto/Archivo usan pipeline, límites y reserva de cuota actuales.
5. Completed se valida antes de proyectar receta; resultado inválido muestra error recuperable y bloquea guardar/compra sin mutar el job histórico.
6. Cada ingrediente proyectado tiene amount_status exact o unknown; exact exige evidencia, cantidad positiva y unidad compatible con parser R2; unknown lleva amount_value y amount_unit null y conserva texto original.
7. Nunca se fabrica amount_value=1 ni otra cantidad ausente. UI muestra Cantidad no indicada o Cantidad por comprobar según evidencia, incluyendo legacy.
8. RecipeAvailability reutiliza evaluateTodayRecipe y estados R2 sin cambiar la semántica de Hoy; alias ambiguo/no resuelto queda unknown, nunca match por string comercial aproximado.
9. Disponibilidad agrupa conceptos repetidos, suma medidas compatibles sin doble contabilizar stock; excluye tombstone/empty/0 y respeta precisión independiente de cantidad/frescura.
10. Tienes N de M cuenta grupos semánticos y desconocidos según diseño; N no afirma suficiencia cuando solo hay presencia. Fixture de dos grupos presentes de cuatro produce 2/4.
11. Resultado diferencia suficiente, presencia con cantidad por comprobar, faltante demostrado y concepto por comprobar; unknown nunca se añade automáticamente a Compra.
12. Para hoy ordena con ranking R2; Puedes hacerlo ahora solo ready; Te falta poco solo missing_one sin unknown ni cantidad por comprobar; otras situaciones conservan etiquetas honestas.
13. GET availability cumple recipe-availability-v1 e incluye snapshot privado, revisión vigente, posiciones y decisiones por grupo; TTL <=60 min e invalidación por despensa, receta/conceptos/motor.
14. Revisión aceptada modifica la proyección vigente e invalida cache; no reescribe el job original, provenance ni snapshot de favorito guardado.
15. Review_required conserva aviso en detalle y favorito; comparación se rotula provisional; compra requiere confirmación explícita del aviso además de faltantes.
16. Compra recibe solo RecipeRef/snapshotKey/clientMutationId; servidor verifica ownership y snapshot y recalcula todos los faltantes dentro de transacción, sin cantidades del cliente.
17. Compra crea/deduplica shopping_items activos por usuario, origen de receta y concepto/unidad compatible, source=recipe_missing y source_ref estable que distingue catalog/import; no fusiona orígenes ni sobrescribe compra manual.
18. Déficit sin cantidad verificable crea faltante sin cantidad inventada; déficit exacto usa cantidad/unidad R2. Si no hay faltantes no se escriben items y CTA está deshabilitado.
19. Replay de compra conserva IDs/resultado y precede a validar estado nuevo; concurrencia no duplica items; mismo mutationId con payload distinto devuelve 409 sin escritura parcial.
20. Snapshot obsoleto/ajeno y receta inválida no escriben compra; conflicto exige recargar/reconfirmar con ID nuevo; fallo de red conserva ID del intento.
21. Guardar en Cocinar resuelve receta autoritativa y persiste snapshot inmutable; doble clic/retry/concurrencia no duplica favorito activo; import no necesita recipe_id de catálogo ficticio.
22. Guardar misma receta ya activa devuelve su identidad estable sin sobrescribir snapshot; versión de receta obsoleta devuelve RECIPE_CONFLICT; quitar y volver a guardar conserva semántica legacy.
23. Original solo ofrece URL http/https válida sin credenciales con apertura segura; fuente manual/file sin URL oculta CTA; no usa URL externa como returnTo interno.
24. Failed traduce códigos técnicos a mensajes útiles; WHISPER_REJECTED ofrece Pegar receta como texto; retry elegible reutiliza job y cuota y no reencola automáticamente históricos.
25. Retry endpoint autentica propietario, verifica retryable y fuente disponible; deduplica concurrencia y deja polling recuperable ante QUEUE_UNAVAILABLE; no consume nueva importación.
26. Loading/vacío/error/offline/sesión caducada son distintos; offline muestra solo lectura anterior fechada del usuario actual y bloquea compra/guardar/retry/upload.
27. Logout/cambio de cuenta cancela respuestas pendientes y oculta datos previos; RLS y 404 uniforme impiden inferir jobs, favoritos y snapshots ajenos.
28. Contratos cook validan JSON estricto y Origin, respuestas private no-store sin cache SW; logs excluyen contenido privado y secretos; endpoints v2 mantienen sus contratos.
29. Deep links Hoy→detalle e import→Compra funcionan; acceso desde guardada a calendario usa ruta legacy y parámetros seguros, sin implementar planificación R6.
30. Flag PRODUCT_V3=false conserva navegación/motor/cuota v2 y fixes R1/R2; APIs cook nuevas 404; flags import independientes no se activan automáticamente.
31. No se reduce la protección de evidencia/review_required de improve-recipe-import-quality; benchmark humano y smoke Whisper/GCS no verificados permanecen documentados y bloquean activación general.
32. Playwright verifica URL/manual/archivo, 2/4, unknown, guardar/compra/replay/conflicto, fallo recuperable, aislamiento/offline y rollback; capturas localhost 320/393 comparadas con 05/07, foco/44px/movimiento reducido.
33. Pasan gates harness, domain typecheck/tests, build, DB lint/pgTAP y suites de worker/Python afectadas; migraciones locales aditivas sin reset. Install frozen obligatorio si cambia lockfile.

## Decisiones de diseño

### data_model

Identidad discriminada RecipeRef={kind:catalog|import,id}; id de catálogo existente o job UUID propio. Importaciones completadas y revisiones aceptadas son privadas: no publicar en recipes global. Proyección RecipeAvailability versionada sobre el resultado válido vigente. Adaptador aditivo añade amount_status=exact|unknown, amount_value:number|null y amount_unit:string|null, preservando texto original y provenance; exact exige cantidad positiva y unidad interpretable por R2. Cantidades sin evidencia o no interpretables quedan unknown/null. Favoritos importados conservan identidad estable por job y snapshot inmutable, con unicidad activa por usuario/origen; reutilizar favorite_recipes con extensión aditiva. La revisión aceptada invalida disponibilidad pero no reescribe snapshots guardados.

### error_states

Distinguir biblioteca vacía, catálogo ausente, import activo/failed/completed inválido/review_required, error de red, offline, sesión caducada y conflicto. Resultado inválido nunca habilita compra/guardar. review_required válido permite ver comparación provisional y guardar con aviso persistente; compra exige confirmar ese aviso además de revisar faltantes. WHISPER_REJECTED ofrece pegar texto, sin reintento automático. Retry de job solo si retryable=true y fuente todavía disponible, sobre mismo job y sin nueva reserva de cuota; fuente eliminada ofrece texto/enlace nuevo.

### edge_cases

Reutilizar evaluateTodayRecipe y ranking R2: aliases exactos únicos o concepto explícito validado; no fuzzy comercial, básicos implícitos ni conversiones peso/volumen/pack/unidad. Tombstones/empty/0 no aportan presencia. Agrupar por concepto antes de comparar y sumar cantidades compatibles una sola vez. N de M cuenta grupos semánticos, cada ingrediente no resuelto como grupo individual; N solo have_enough o have_presence_unknown_amount. Déficit exacto también es faltante aunque haya presencia parcial. Unknown no cuenta como faltante ni se añade automáticamente. Sin escalado de raciones. Import y favorito del mismo origen aparecen una vez en cada colección; no deduplicar recetas distintas por título.

### auth_secrets

Sesión Supabase y RLS para jobs, revisiones, favoritos, cache y compra. Autoridad de usuario derivada del servidor; ignorar/rechazar userId, receta completa, inventario, cantidades y planes del cliente en operaciones v3. Job ajeno/inexistente devuelve mismo 404. Endpoints privados no-store, fuera del service worker compartido. Logout cancela solicitudes y oculta cache/datos anteriores. Mutaciones JSON estrictas y Origin same-origin. Validar URL original http/https sin credenciales; no aceptar javascript/data/file ni imprimir contenido, tokens o nombres privados en logs. Mantener SSRF, OIDC y secretos de los proveedores actuales.

### external_contracts

GET /api/cook/library?view=today|saved|imported&limit=20&cursor=<opaque> devuelve {contract:cook-library-v1,items,nextCursor}; límite 1..50, cursor ligado a usuario/view/version; cursor inválido 400 CURSOR_INVALID. GET /api/cook/availability?kind=catalog|import&id=<UUID> devuelve {contract:recipe-availability-v1,recipeRef,recipeVersion,snapshotKey,computedAt,expiresAt,availability,haveCount,totalCount,missingCount,unknownCount,quantityToCheck,ingredients,reviewRequired}; ingredients preserva posición/texto/amount_status/value/unit/conceptId y decisión R2 por grupo. Snapshot privado máximo 60 min, clave incluye identidad/revisión de receta, inventario/conceptos y versión motor; se invalida ante cualquier cambio relevante. POST /api/cook/shopping recibe exactamente {recipeRef,snapshotKey,clientMutationId}; POST /api/cook/save exactamente {recipeRef,recipeVersion,clientMutationId}; recipeRef={kind,id}, snapshotKey y mutationId UUID, recipeVersion token opaco. Respuesta mutación {contract:cook-mutation-v1,status:applied|duplicate,result:{itemIds}|{favoriteId,version}}. Error {contract:cook-error-v1,error:{code,message,retryable}}; 400 INVALID_REQUEST,401 AUTH_REQUIRED,404 RECIPE_NOT_FOUND,409 SNAPSHOT_CONFLICT|RECIPE_CONFLICT|MUTATION_CONFLICT,422 RECIPE_INVALID,503 COOK_UNAVAILABLE. Replay con mismo payload devuelve resultado original, mismo ID con otro payload 409. POST /api/recipe-jobs/[jobId]/retry sin body reutiliza job y reserva, deduplica enqueue concurrente, 409 RETRY_NOT_AVAILABLE si no es elegible; conserva contrato recipe-import-job-v1/error-v1. Creation/upload/review/reprocess existentes mantienen sus contratos y flags.

### ui_states

Cocinar /app/cook?view=today|saved|imported, default today; query no reconocida vuelve a today. Para hoy agrupa ready en Puedes hacerlo ahora y missing_one con unknownCount=0 y quantityToCheck=false en Te falta poco; resto claramente etiquetado, nunca presentado como ready. Guardadas presenta Tus guardadas e Importadas incluye jobs pendientes/fallidos/completados ordenados created_at desc/id desc. Para hoy usa ranking R2 y paginación estable; Guardadas saved_at desc/id desc. Traer receta abre /app/recipes/import con Enlace/Texto/Archivo existentes. Resultado /app/recipes/import/[jobId] muestra Tienes N de M, filas Suficiente/Lo tienes, cantidad por comprobar/Te falta/Por comprobar y cantidades no indicadas. CTA compra solo faltantes demostrados, confirmación explícita (y aviso review_required); guardar y original. Loading, vacío, error/retry, offline y sesión caducada con foco visible, objetivos 44px y sin overflow 320px. Enlaces Hoy a detalle mantienen /app/recipes/[id]; saved a calendario legacy con parámetros seguros, sin implementar plan semanal R6. Capturas localhost 320/393 contra referencias 05/07, sin inventar fotografías de receta.

### rollback_compat

PRODUCT_V3 false mantiene v2 y /app/cook redirige /app/recipes; API nuevas 404. Flags de calidad/revisión/reproceso siguen independientes y apagadas por defecto. Imports legacy se leen conservadoramente sin backfill ni reescribir job/result/provenance; completed no certifica fidelidad. Migraciones aditivas, sin db reset, down migrations, seeds remotos ni cambios Stripe/usage. R3 no modifica motor Hoy ni consumo R4/agrupación Compra R5/plan R6/Pro R7. No activar producción ni desplegar worker/proveedores como efecto de preparar o implementar. Carryover humano benchmark y canary queda como gate de activación, no requisito para ocultar la biblioteca local.

### tests

Harness typecheck/lint/test/diff-scope, domain typecheck/tests, build web; worker y Python solo si cambia su código. pgTAP/RLS dos usuarios, unicidad import/favorito, snapshot conflict/replay/concurrencia y cuota invariable en retry/guardar/compra. DB lint y migraciones aditivas locales sin reset; fixtures SQL rollback. Playwright DB local + mocks Vision/media/proveedores: URL/texto/archivo, recarga job, resultado 2/4, cantidades unknown, review_required, compra, guardar doble clic, errores recuperables, offline/logout, conflicto y flag false. Comparación visual 320/393 con capturas API real (mocks de presentación marcados). Mantener aceptación de improve-recipe-import-quality y carryover explícito: corpus humano 12 casos split8/4, veinte ejecuciones warm, métricas/umbrales de spec original, WebKit/Firefox y smoke real URL/subida Whisper/GCS. Sin evidencia no declarar fidelidad ni cerrar gate de rollout. Si cambia lockfile ejecutar install frozen.
