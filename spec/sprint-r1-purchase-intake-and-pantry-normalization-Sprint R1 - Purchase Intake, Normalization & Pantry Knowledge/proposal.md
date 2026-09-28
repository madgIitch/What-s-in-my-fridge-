# Sprint R1 — Propuesta para aprobación

Estado: spec_ready; spec_approved: false. Preparación manual con revisión de ocho dimensiones: este checkout no expone el comando prepare indicado en HARNESS.md. No se ha implementado R1.

# Entrevista · sprint-r1-purchase-intake-and-pantry-normalization · Sprint R1 - Purchase Intake, Normalization & Pantry Knowledge

- name: `Sprint R1 - Purchase Intake, Normalization & Pantry Knowledge`
- estado: **dimensiones cubiertas** → aprueba con `spec.mjs approve sprint-r1-purchase-intake-and-pantry-normalization`

## Decisiones registradas

### [data_model] (resuelto)

**R:** Extensiones aditivas a R0: raw_name/raw_text, retailer y origen draft/line, normalizer_version, ubicación nullable (fridge/pantry/freezer), mappings privados y manifests de catálogo. Una línea aceptada produce una fila; sin fusionar compras distintas. Cantidad, fecha de compra, frescura y normalización mantienen precisión/procedencia independientes. Defaults sintéticos del parser v1 no constituyen evidencia.

### [error_states] (resuelto)

**R:** OCR conserva códigos, cuotas y privacidad existentes. Catálogo ausente/corrupto no bloquea revisión; se usa unknown. Confirmación es atómica, replay idéntico devuelve mismos IDs; replay distinto devuelve 409. Sin conexión se permite lectura y edición local, pero OCR y confirmación de ticket necesitan conexión. Cambios fallidos muestran Reintentar sin jerga técnica.

### [edge_cases] (resuelto)

**R:** No sumar packs ni convertir a contenido interno sin tamaño y unidad verificados. Líneas duplicadas con IDs diferentes se conservan; IDs duplicados o ajenos al draft se rechazan. Fecha civil inválida, ambigua o futura requiere corrección o fallback explícito al día local de confirmación. Mappings del usuario prevalecen siempre; Por ubicar evita inventar ubicación. Pendientes tras confirmar enriquecen la fila existente, nunca crean otra.

### [auth_secrets] (resuelto)

**R:** Todas las operaciones privadas se autorizan por sesión y RLS. No confiar en userId enviado ni en raw/provenance/concept/stock suministrados sin validación. Catálogos globales se escriben solo con tooling privilegiado fuera del cliente. Mantener bucket privado y secretos server-only; no registrar PII del ticket. Voz/cámara solo tras acción del usuario; sin proveedor nuevo de audio.

### [external_contracts] (resuelto)

**R:** Reutilizar POST /api/ocr y almacenamiento de Sprint 5. Nuevas rutas GET /api/ocr/v2/drafts/[draftId], POST /api/ocr/v2/normalize, POST /api/ocr/v2/confirm y PATCH /api/ocr/v2/drafts/[draftId]/lines/[lineId]. Normalización determinista por mapping usuario, identificador exacto, alias exacto único y candidatos fuzzy solo dudosos. Importar exports locales versionados de cinco retailers; no scraping en el flujo interactivo. Fuente real copiada al repo: docs/catalogs/data/eroski_checkpoint.json, snapshot parcial con 23172 productos y checksum en docs/catalogs/local-sources.manifest.json; no inventar fetched_at. Exports finales de Eroski están vacíos. Cuatro retailers carecen de export localizado: adapters sobre contrato canónico y fixtures, estado ausente documentado. Aldi copiado para conservación pero su ingesta queda fuera del alcance R1. Ver docs/catalogs/R1_LOCAL_SOURCES.md.

### [ui_states] (resuelto)

**R:** PRODUCT_V3 reutiliza shell R0. /app/add-purchase con ticket principal y barcode/voz/manual secundarios; /app/add-purchase/[draftId] revisa solo dudosas y permite ver resueltas; /app/pantry busca y agrupa; /app/pantry/[itemId] edita. Referencias 01/06/08: rosa, crema, ciruela, coral, ámbar para incertidumbre, blancos cómodos y objetivos 44px. Sin datos de demostración dentro de la despensa real. Carga, vacío, sin resultados, error y offline con acciones visibles.

### [rollback_compat] (resuelto)

**R:** Flag server-only PRODUCT_V3 false conserva rutas, confirmación OCR y UI v2. Rutas /app/scan y /app/items/* siguen disponibles. RPC v3 separadas preservan el payload de v2; IndexedDB evoluciona aditivamente, cache/outbox separados por usuario. No reinterpretar expiry_date ni quantity legacy; no borrar datos, resetear DB, activar producción ni hacer backfill automático.

### [tests] (resuelto)

**R:** Unit tests de normalización/cantidades/fechas/importadores, pgTAP para aislamiento, integridad, replay/concurrencia y precedencia. Playwright con Vision mock y DB local: ticket limpio, tres dudosos, correction/unknown/omit, catálogo ausente, barcode y voz no disponibles, offline con reconexión/conflicto, dos usuarios, flag false, 320px. Comparación visual real en localhost frente a 01/06/08, capturas y diferencias documentadas. Harness gates más domain typecheck/tests, db lint y SQL; humo real con catálogo/ticket cuando estén disponibles.

## Cobertura de dimensiones

- ✅ data_model — Extensiones aditivas a R0: raw_name/raw_text, retailer y origen draft/line, normalizer_version, ubicación nullable (fridge/pantry/freezer), mappings privados y manifests de catálogo. Una línea aceptada produce una fila; sin fusionar compras distintas. Cantidad, fecha de compra, frescura y normalización mantienen precisión/procedencia independientes. Defaults sintéticos del parser v1 no constituyen evidencia.
- ✅ error_states — OCR conserva códigos, cuotas y privacidad existentes. Catálogo ausente/corrupto no bloquea revisión; se usa unknown. Confirmación es atómica, replay idéntico devuelve mismos IDs; replay distinto devuelve 409. Sin conexión se permite lectura y edición local, pero OCR y confirmación de ticket necesitan conexión. Cambios fallidos muestran Reintentar sin jerga técnica.
- ✅ edge_cases — No sumar packs ni convertir a contenido interno sin tamaño y unidad verificados. Líneas duplicadas con IDs diferentes se conservan; IDs duplicados o ajenos al draft se rechazan. Fecha civil inválida, ambigua o futura requiere corrección o fallback explícito al día local de confirmación. Mappings del usuario prevalecen siempre; Por ubicar evita inventar ubicación. Pendientes tras confirmar enriquecen la fila existente, nunca crean otra.
- ✅ auth_secrets — Todas las operaciones privadas se autorizan por sesión y RLS. No confiar en userId enviado ni en raw/provenance/concept/stock suministrados sin validación. Catálogos globales se escriben solo con tooling privilegiado fuera del cliente. Mantener bucket privado y secretos server-only; no registrar PII del ticket. Voz/cámara solo tras acción del usuario; sin proveedor nuevo de audio.
- ✅ external_contracts — Reutilizar POST /api/ocr y almacenamiento de Sprint 5. Nuevas rutas GET /api/ocr/v2/drafts/[draftId], POST /api/ocr/v2/normalize, POST /api/ocr/v2/confirm y PATCH /api/ocr/v2/drafts/[draftId]/lines/[lineId]. Normalización determinista por mapping usuario, identificador exacto, alias exacto único y candidatos fuzzy solo dudosos. Importar exports locales versionados de cinco retailers; no scraping en el flujo interactivo. Fuente real copiada al repo: docs/catalogs/data/eroski_checkpoint.json, snapshot parcial con 23172 productos y checksum en docs/catalogs/local-sources.manifest.json; no inventar fetched_at. Exports finales de Eroski están vacíos. Cuatro retailers carecen de export localizado: adapters sobre contrato canónico y fixtures, estado ausente documentado. Aldi copiado para conservación pero su ingesta queda fuera del alcance R1. Ver docs/catalogs/R1_LOCAL_SOURCES.md.
- ✅ ui_states — PRODUCT_V3 reutiliza shell R0. /app/add-purchase con ticket principal y barcode/voz/manual secundarios; /app/add-purchase/[draftId] revisa solo dudosas y permite ver resueltas; /app/pantry busca y agrupa; /app/pantry/[itemId] edita. Referencias 01/06/08: rosa, crema, ciruela, coral, ámbar para incertidumbre, blancos cómodos y objetivos 44px. Sin datos de demostración dentro de la despensa real. Carga, vacío, sin resultados, error y offline con acciones visibles.
- ✅ rollback_compat — Flag server-only PRODUCT_V3 false conserva rutas, confirmación OCR y UI v2. Rutas /app/scan y /app/items/* siguen disponibles. RPC v3 separadas preservan el payload de v2; IndexedDB evoluciona aditivamente, cache/outbox separados por usuario. No reinterpretar expiry_date ni quantity legacy; no borrar datos, resetear DB, activar producción ni hacer backfill automático.
- ✅ tests — Unit tests de normalización/cantidades/fechas/importadores, pgTAP para aislamiento, integridad, replay/concurrencia y precedencia. Playwright con Vision mock y DB local: ticket limpio, tres dudosos, correction/unknown/omit, catálogo ausente, barcode y voz no disponibles, offline con reconexión/conflicto, dos usuarios, flag false, 320px. Comparación visual real en localhost frente a 01/06/08, capturas y diferencias documentadas. Harness gates más domain typecheck/tests, db lint y SQL; humo real con catálogo/ticket cuando estén disponibles.

## Scope propuesto

- `apps/web/src/app/(auth)/app/add-purchase/**`
- `apps/web/src/app/(auth)/app/pantry/**`
- `apps/web/src/components/purchase/**`
- `apps/web/src/components/pantry/**`
- `apps/web/src/lib/receipt/**`
- `apps/web/src/lib/normalization/**`
- `apps/web/src/lib/inventory/**`
- `packages/domain/src/pantry/**`
- `packages/domain/src/normalization/**`
- `scripts/catalogs/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/**`
- `docs/catalogs/**`
- `spec.json`
- `apps/web/src/app/api/ocr/**`
- `apps/web/src/app/(auth)/app/scan/**`
- `apps/web/src/components/receipt/**`
- `apps/web/src/components/navigation/product-v3-nav*`
- `apps/web/src/styles/product-v3.css`
- `apps/web/src/types/database.generated.ts`
- `packages/domain/src/receipt/**`
- `packages/domain/src/index.ts`

## Acceptance propuesto

1. Confirmar un ticket crea exactamente una fila por línea aceptada, idempotente por draft/line id.
2. Una línea resuelta conserva raw_text/raw_name y muestra un nombre humano normalizado.
3. Una corrección de usuario crea/actualiza un mapping con mayor precedencia para ese usuario y no se sobreescribe automáticamente después.
4. Una línea no resuelta puede confirmarse como unknown o excluirse; el sistema no inventa food_concept.
5. El catálogo de un retailer ausente o fallido no bloquea OCR ni review.
6. Los datasets de catálogo tienen source, fetched_at/checksum y se cargan idempotentemente.
7. Una cantidad de ticket solo se guarda como exact si su semántica es inequívoca; '1 unidad' de un pack no se convierte a contenido interno sin evidencia del producto.
8. acquired_on se presenta como 'Comprado el sábado' o equivalente local, sin convertirlo en caducidad.
9. Una ventana estimada se muestra como 'unos N días/semanas' con copy que la identifica como estimación.
10. La UI de Despensa no muestra synced, 'sincronizar' ni cuota; solo avisa si hay un problema real.
11. Offline: items ya confirmados se leen desde IndexedDB y cambios cualitativos se encolan.
12. Playwright cubre ticket limpio, 3 dudosos, corrección, omisión, retailer desconocido, offline y viewport 320 px.
13. PRODUCT_V3=true: + abre /app/add-purchase con Escanear ticket, Código de barras, Voz y Manual; ticket es la acción principal. Barcode permite introducir el código si no hay cámara/detector. Voz permite dictado iniciado por usuario cuando el navegador lo soporte y escritura cuando no; el texto se revisa antes de guardar. No se guardan productos por reconocer un código o una frase sin confirmación.
14. La revisión muestra resuelto/dudoso/omitir; resueltas aceptadas por defecto, dudosas nunca autoaceptadas por fuzzy. Hay como máximo tres conceptos candidatos ordenados deterministamente y acciones Otro (buscar concepto o nombre libre unknown) y Omitir. Mantener como desconocido permite confirmar sin inventar concepto. Cero líneas aceptadas no confirma ni crea items.
15. Precedencia: mapping confirmado del usuario para retailer+raw_name normalizado, barcode/product code exacto y coherente, alias exacto único con food_concept, después hasta tres candidatos fuzzy. Normalizar caso/acentos/espacios; candidatos con al menos un token alfanumérico común, ordenados por Jaccard de tokens descendente y food_concept slug ascendente, deduplicados por concepto. Conflicto entre identificadores o empate exacto es dudoso. Fuzzy solo propone candidatos; no existe umbral de score que confirme automáticamente. Sin candidatos queda unknown.
16. POST /api/ocr/v2/normalize recibe {draftId}; el servidor carga el draft propio y devuelve {draftId,normalizerVersion,lines} con lineId,rawName,displayName,resolution,candidates y conocimiento de cantidad/compra/frescura. GET /api/ocr/v2/drafts/[draftId] recupera esa revisión y sus decisiones persistidas. No devolver confidence ni scores al usuario.
17. POST /api/ocr/v2/confirm recibe {draftId,normalizerVersion,lines:[{lineId,decision:accept|unknown|omit,foodConceptId?,displayName?,location?}],purchaseDate?}. IDs, candidatos, nombres (1–120 caracteres) y evidencia se validan sobre el draft almacenado. Devuelve {draftId,status:confirmed,itemIds,pendingCount}. Commit atómico por draft: replay idéntico devuelve mismos IDs, payload cambiado tras confirmar devuelve 409 DRAFT_STATE_CONFLICT. Rechazar IDs repetidos, ajenos y ownership inyectado.
18. PATCH /api/ocr/v2/drafts/[draftId]/lines/[lineId] recibe {clientMutationId,expectedVersion,decision:resolve|omit,foodConceptId?,displayName?} para pendientes ya confirmados. Resolve actualiza el item existente y mapping privado; omit aplica tombstone. Replay es idempotente, versión desfasada devuelve 409 SYNC_CONFLICT; no sobrescribe cambios concurrentes. Solo afecta líneas pendientes del propietario.
19. El banner cuenta líneas unknown de la última compra confirmada que aún tienen item activo; abre solo sus pendientes, desaparece al resolver/omitir todas y no se oculta mientras un catálogo nuevo siga sin confirmar esos items. Corrección posterior actualiza el item original, nunca lo duplica.
20. El 1/unit sintético del parser v1 o un precio no constituyen evidencia de cantidad. Guardar presencia con quantity_precision=unknown salvo cantidad/unidad explícitas y coherentes. Un pack puede registrar 1 pack exacto solo con evidencia de compra; registrar 12 huevos exige evidencia del contenido. Edición por usuario puede fijar cantidad y unidad exactas sin imponer una fecha de caducidad.
21. Despensa agrupa en Nevera, Armario, Congelador y Por ubicar para ubicación desconocida; ubicación sugerida del concepto se identifica como propuesta hasta confirmación. Buscador ignora caso y acentos sobre display_name/raw_name. Contador excluye tombstones; Se acabó sigue visible como estado vacío, sin eliminar el item ni contarlo como disponible.
22. En /app/pantry/[itemId] se puede cambiar ubicación, nombre/concepto, nota, cantidad exacta o estados Bastante/Poco/Se acabó, y fecha exacta opcional declarada por usuario. Pasar de exacto a cualitativo elimina cantidad_exact/unit autoritativas del estado actual sin alterar evidencia original del ticket. Eliminar es tombstone; Deshacer disponible 8 segundos en primer plano restaura con nueva mutación y detecta conflicto.
23. Fecha de compra usa civil YYYY-MM-DD validada, no conversión UTC de medianoche. Si ticket no da fecha fiable, registrar fecha local de confirmación con source=user y copy que no la atribuye al ticket. La estimación muestra ventana y origen: Conservación estimada: unos N días/semanas desde la compra; nunca se presenta bajo Caduca ni se convierte en expiry_date_exact. Sin default documentado queda desconocida.
24. Manifest por retailer con schema_version,source,fetched_at,sha256 y registros identificados por retailer_product_id o barcode. Validar hash/esquema antes de escribir, staging transaccional y upsert estable; un fallo no sustituye el catálogo anterior. Importadores para Mercadona,DIA,Lidl,Carrefour,Eroski permiten dry-run y reporte importado/rechazado/ausente. Fixtures sintéticas no se reportan como integración de datos reales.
25. Validar un snapshot congelado de eroski_checkpoint.json real: products es array, id->retailer_product_id, name->display_name; marcas/categorías conservan provenance. Manifest distingue captured_at de fetched_at (nullable si no existe evidencia) y completeness=partial. metrics_item.quantity es analítica comercial y nunca cantidad comprada, pack ni stock. Exports vacíos no sustituyen catálogo útil. Los cuatro exports no encontrados se reportan ausentes; la prueba real de Eroski debe pasar y las cinco formas de entrada canónica tienen fixtures. Aldi no se ingesta en R1.
26. Offline conserva cache por usuario y encola edición cualitativa/ubicación/nota con clientMutationId y expectedVersion. Reconexión aplica una vez; conflicto conserva ambos valores para elección explícita. No mostrar sincronizar/synced/cuota en Despensa; mostrar solo aviso offline o cambios fallidos con Reintentar. Logout/cambio de cuenta no revela datos ni envía outbox del otro usuario.
27. Flag apagada conserva confirmación, rutas y comportamiento v2, sin aplicar normalización v3 ni actualizar precisión legacy. Actualizar tipos generados desde DB local y comprobar que migraciones son aditivas. No modificar límites OCR, proveedores de receta, recomendaciones de Hoy, cocina guiada, planificación, monetización ni lista de compra en R1.
28. Capturas reales de localhost en 320px y un ancho móvil representativo documentan comparación con referencias 01/06/08: jerarquía, buscador, banner pendiente, agrupaciones, estado cualitativo, editor y CTA de compra. Sin overflow horizontal; controles >=44px, navegación por teclado, foco al cerrar menú y respeto por movimiento reducido. Ilustraciones auxiliares no sustituyen información ni retrasan legibilidad.

