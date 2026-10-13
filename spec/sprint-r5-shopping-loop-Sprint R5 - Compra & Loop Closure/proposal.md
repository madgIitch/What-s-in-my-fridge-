# R5 · propuesta de spec

Preparado el 13 de octubre de 2026. Estado spec_ready; spec_approved=false.
No se ha implementado R5.

# Entrevista · sprint-r5-shopping-loop · Sprint R5 - Compra & Loop Closure

- name: `Sprint R5 - Compra & Loop Closure`
- estado: **dimensiones cubiertas** → aprueba con `spec.mjs approve sprint-r5-shopping-loop`

## Decisiones registradas

### [data_model] (resuelto)

**R:** shopping_list_items ampliada de forma aditiva (source, food_concept_id, selection, purchased_at, purchase_ref, shopping_session_id); shopping_item_sources para procedencia múltiple; shopping_sessions y shopping_events append-only para reconciliación y deshacer. Sugerencias persistidas como selection=suggested, nunca stock. checked (tienda) y purchased (ticket) son estados distintos.

### [error_states] (resuelto)

**R:** shopping-error-v1 con 401/400/404/409/503. Replay antes de validar estado; conflicto de versión conserva intención. Reconciliación falla cerrada y nunca autocierra ambiguos. Offline pendiente no es éxito. Deshacer con ventana de cinco minutos y versiones estrictas, sin restauración parcial.

### [edge_cases] (resuelto)

**R:** Dedupe solo con concepto y unidad compatibles; unknown, pack/unit y peso/volumen no se suman. Sin concepto solo fusiona nombre normalizado idéntico. Stock exacto no genera sugerencias; descartada no resucita con la misma versión. Receta origen borrada, ticket abandonado, ticket sin sesión, cobertura parcial, múltiples candidatos y item checked sin ticket quedan definidos.

### [auth_secrets] (resuelto)

**R:** auth.uid y RLS en todas las tablas nuevas; SECURITY DEFINER con search_path vacío y grants mínimos. Requests sin userId ni source arbitrario; Origin same-origin y JSON estricto; cache private,no-store; 404 uniforme. Logout purga cache y outbox de Compra. Sin datos privados en logs.

### [external_contracts] (resuelto)

**R:** GET /api/shop/v1/list y POST /api/shop/v1/mutations (shopping-list-v1, shopping-mutation-v1); RPC reconcile_shopping_after_receipt_v1 invocada tras ticket confirmado; enlace /app/scan?shoppingSession=<UUID>. Contratos R1 confirm_receipt_draft_v2, R2 apply_today_shopping_v1 y legacy apply_shopping_list_mutation no cambian.

### [ui_states] (resuelto)

**R:** /app/shop con tres secciones, alta rápida, detalle explicativo por item, CTA He terminado y Revisar compra tras ticket. Estados cargando/vacío/error/offline/pendiente/conflicto diferenciados; 320/393 px, 44 px, foco, reduced-motion y referencia 04-shopping-list.png sin contenido inventado.

### [rollback_compat] (resuelto)

**R:** PRODUCT_V3=false conserva /app/shopping-list y APIs legacy; /api/shop/v1 da 404 sin escrituras. Filas legacy y de Today migran como legacy/recipe_missing sin pérdida ni duplicados. Migraciones solo locales aditivas; sin R6/R7, proveedores ni cambios a R1/R4.

### [tests] (resuelto)

**R:** Harness, domain, build, DB lint y pgTAP (RLS dos usuarios, idempotencia, atomicidad, reconciliación, deshacer). Playwright local con offline real, conflicto entre dispositivos, ticket y rollback; capturas 320/393 con DB/API reales y mocks de proveedor identificados.

## Cobertura de dimensiones

- ✅ data_model — shopping_list_items ampliada de forma aditiva (source, food_concept_id, selection, purchased_at, purchase_ref, shopping_session_id); shopping_item_sources para procedencia múltiple; shopping_sessions y shopping_events append-only para reconciliación y deshacer. Sugerencias persistidas como selection=suggested, nunca stock. checked (tienda) y purchased (ticket) son estados distintos.
- ✅ error_states — shopping-error-v1 con 401/400/404/409/503. Replay antes de validar estado; conflicto de versión conserva intención. Reconciliación falla cerrada y nunca autocierra ambiguos. Offline pendiente no es éxito. Deshacer con ventana de cinco minutos y versiones estrictas, sin restauración parcial.
- ✅ edge_cases — Dedupe solo con concepto y unidad compatibles; unknown, pack/unit y peso/volumen no se suman. Sin concepto solo fusiona nombre normalizado idéntico. Stock exacto no genera sugerencias; descartada no resucita con la misma versión. Receta origen borrada, ticket abandonado, ticket sin sesión, cobertura parcial, múltiples candidatos y item checked sin ticket quedan definidos.
- ✅ auth_secrets — auth.uid y RLS en todas las tablas nuevas; SECURITY DEFINER con search_path vacío y grants mínimos. Requests sin userId ni source arbitrario; Origin same-origin y JSON estricto; cache private,no-store; 404 uniforme. Logout purga cache y outbox de Compra. Sin datos privados en logs.
- ✅ external_contracts — GET /api/shop/v1/list y POST /api/shop/v1/mutations (shopping-list-v1, shopping-mutation-v1); RPC reconcile_shopping_after_receipt_v1 invocada tras ticket confirmado; enlace /app/scan?shoppingSession=<UUID>. Contratos R1 confirm_receipt_draft_v2, R2 apply_today_shopping_v1 y legacy apply_shopping_list_mutation no cambian.
- ✅ ui_states — /app/shop con tres secciones, alta rápida, detalle explicativo por item, CTA He terminado y Revisar compra tras ticket. Estados cargando/vacío/error/offline/pendiente/conflicto diferenciados; 320/393 px, 44 px, foco, reduced-motion y referencia 04-shopping-list.png sin contenido inventado.
- ✅ rollback_compat — PRODUCT_V3=false conserva /app/shopping-list y APIs legacy; /api/shop/v1 da 404 sin escrituras. Filas legacy y de Today migran como legacy/recipe_missing sin pérdida ni duplicados. Migraciones solo locales aditivas; sin R6/R7, proveedores ni cambios a R1/R4.
- ✅ tests — Harness, domain, build, DB lint y pgTAP (RLS dos usuarios, idempotencia, atomicidad, reconciliación, deshacer). Playwright local con offline real, conflicto entre dispositivos, ticket y rollback; capturas 320/393 con DB/API reales y mocks de proveedor identificados.

## Scope propuesto

- `apps/web/src/app/(auth)/app/shop/**`
- `apps/web/src/app/(auth)/app/shopping-list/**`
- `apps/web/src/app/(auth)/app/scan/**`
- `apps/web/src/app/api/shop/v1/**`
- `apps/web/src/components/shop/**`
- `apps/web/src/components/shopping-list/**`
- `apps/web/src/components/navigation/**`
- `apps/web/src/components/cook/recipe-availability.tsx`
- `apps/web/src/lib/shopping-list/**`
- `apps/web/src/lib/shop/**`
- `apps/web/src/types/database.generated.ts`
- `packages/domain/src/shopping-list/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/**`
- `docs/**`
- `spec.json`

## Acceptance propuesto

1. Con PRODUCT_V3=true, /app/shop es la superficie canónica de Compra con secciones Para tus recetas, Sugerencias por poco stock y Añadido por ti; la navegación v3 apunta a ella y /app/shopping-list redirige a /app/shop conservando parámetros seguros. Con PRODUCT_V3=false, /app/shopping-list y /api/shopping-list siguen intactos y /app/shop redirige sin escrituras.
2. Migración aditiva sobre shopping_list_items: source (recipe_missing|low_stock_suggestion|manual|legacy), food_concept_id nullable, selection (selected|suggested|dismissed), purchased_at, purchase_ref, shopping_session_id. Filas legacy pasan a source=legacy, selection=selected, checked intacto; nada se borra ni se reinterpreta. checked significa tachado en tienda y purchased_at significa resuelto por ticket o alta equivalente; son estados distintos.
3. Nueva tabla shopping_item_sources con una fila por origen (item_id, source, source_ref, quantity, unit, created_at). source_ref es {kind:catalog|import|favorite,id:UUID} para recipe_missing y {inventoryItemId,conceptId,stockVersion} para low_stock_suggestion. Un item puede tener varios orígenes; fusionar nunca descarta ni reescribe procedencia. RLS por user_id.
4. recipe_missing se crea solo por acción explícita (Añadir lo que falta en disponibilidad R3, detalle de receta, Hoy R2) y conserva la receta origen; el detalle del item enlaza de vuelta a /app/recipes/<id> o import según source_ref y muestra por qué aparece. Una receta borrada o ajena muestra origen no disponible sin romper la lista.
5. low_stock_suggestion se deriva en servidor solo de lotes propios con stock qualitative low o empty y concepto resuelto; el stock exacto nunca genera sugerencia por umbral inventado ni stock unknown. Se persiste como selection=suggested y no entra en la lista seleccionada ni en contadores de compra hasta que el usuario la acepta (Añadir a mi compra) o la descarta.
6. Descartar una sugerencia la marca dismissed y la suprime hasta que cambie la versión del lote de origen. Refrescar sugerencias es idempotente: no duplica filas por (user, concepto, origen) ni resucita descartadas con la misma stockVersion. Sugerir no escribe nunca en inventario ni cambia el estado de la despensa.
7. Deduplicación por food_concept_id y unidad canónicamente compatible (g/kg, ml/l, unit con unit, pack con pack); suma decimal con aritmética exacta. Nunca suma 2 unidades con 500 g, ni cantidades unknown con exactas, ni pack con unit sin conversión demostrada; en esos casos conserva líneas separadas o cantidad null con todos los orígenes. Sin fuzzy matching ni escalado automático de raciones.
8. Items sin concepto resuelto solo se fusionan con idéntico nombre normalizado (misma función de R1) y misma unidad; nunca por similitud. Un item manual con nombre que coincide inequívocamente con un concepto puede enlazarse a él, pero un alias ambiguo queda sin concepto y sin fusión.
9. Alta manual rápida: campo de una línea Añadir algo con nombre obligatorio y cantidad/unidad opcionales; crea source=manual, selection=selected con clientMutationId. Marcar o desmarcar un item, manual o no, solo cambia checked y nunca crea, edita ni vacía items de despensa. Eliminar es soft-delete reversible con deshacer de cinco minutos.
10. POST /api/shop/v1/mutations recibe estrictamente {clientMutationId:UUID,op:add_manual|check|uncheck|select|dismiss|remove|restore,itemId?:UUID,expectedVersion?:integer,name?,quantity?,unit?}; sin userId, source arbitrario ni fechas. Server autentica, valida ownership y versión, aplica en una transacción y devuelve shopping-mutation-v1 {status:applied|duplicate|conflict,item,version}. Replay del mismo ID y payload canónico devuelve el resultado original; mismo ID con otro payload da 409 MUTATION_CONFLICT.
11. GET /api/shop/v1/list acepta solo parámetros de sesión opcionales y devuelve shopping-list-v1 {sections:{recipes,suggestions,manual},counts,version,serverTime}; cada item incluye id,name,quantity|null,unit|null,conceptId|null,checked,selection,sources[],version y reason en español derivada de sus orígenes. Cache-Control private,no-store; JSON estricto y Origin same-origin; error shopping-error-v1 {error:{code,message,retryable}} con 401 AUTH_REQUIRED,400 INVALID_REQUEST,404 ITEM_NOT_FOUND,409 VERSION_CONFLICT|MUTATION_CONFLICT,503 SHOP_UNAVAILABLE.
12. Cada item expone una explicación contextual en lenguaje natural: Falta para <receta> (+N más), Te queda poco <alimento> en <ubicación> o Lo añadiste tú; el detalle lista todas las recetas y lotes de origen con enlace. No inventa cantidades ni motivos; un item sin procedencia fiable muestra Añadido antes de la nueva lista.
13. Offline: lectura de la última lista cargada, checks, altas manuales, selección/descarte y borrado funcionan con outbox propio aislado por usuario y versión de esquema, mostrando Sin conexión, tu lista sigue funcionando. No muestra Aplicado hasta confirmación del servidor; pendiente, conflicto y error son estados visuales distintos. Reenvío conserva clientMutationId y payload; conflicto de versión conserva la intención y pide revisión, sin sobrescribir cambios de otro dispositivo.
14. Outbox de Compra no modifica ni comparte almacenamiento con outboxes de inventario/cocina; logout o cambio de cuenta cancela requests, oculta y purga lista cacheada e intenciones de la cuenta saliente. No hay cache HTTP/SW compartido de datos privados.
15. CTA He terminado, añadir ticket crea o reutiliza una shopping_session (UUID, por usuario) y abre /app/scan?shoppingSession=<UUID> preservando contexto; el parámetro se valida como UUID propio y se ignora si es inválido o ajeno. La ruta /app/add-purchase/ticket citada en el spec original no existe: el flujo de ticket vigente es /app/scan y no se crea ruta nueva. Terminar la compra no crea items de despensa ni cierra items.
16. Reconciliación posterior al ticket: RPC reconcile_shopping_after_receipt_v1(p_draft_id,p_client_mutation_id) invocada tras draft confirmado y no dentro de confirm_receipt_draft_v2, cuyo contrato R1 no cambia. Es idempotente por (user, draft) y devuelve {matched,ambiguous,unmatched}; solo lee confirmed_item_ids del draft propio y falla cerrado si el draft no pertenece al usuario o no está confirmado.
17. Un shopping_item pasa a purchased solo con coincidencia fiable: mismo food_concept_id no nulo entre item y lote confirmado, o commercial_product vinculado, y unidad compatible; la cantidad comprada cubre o supera lo pedido o el item no tenía cantidad. Cobertura parcial reduce lo pendiente sin cerrar el item. Concepto null, ambiguo o varios candidatos quedan pendientes en Revisar compra con selección explícita y nunca se autocierran.
18. Items checked pero sin ticket permanecen pendientes de reconciliación tras confirmar; items no encontrados en el ticket no se marcan comprados. Cancelar o abandonar el ticket deja la lista intacta. Un ticket confirmado sin sesión de compra puede reconciliar igualmente por la misma regla conservadora solo si el usuario lo acepta en un resumen explícito.
19. Deshacer reconciliación: durante cinco minutos desde el servidor, purchased_at/purchase_ref pueden revertirse con evento compensatorio único y versiones estrictas; cambio posterior da 409 UNDO_CONFLICT sin restauración parcial. Reconciliar no modifica inventario, lotes ni el draft; solo shopping_list_items y su evento.
20. Hoy R2 y disponibilidad R3 siguen reflejando solo la despensa real: una sugerencia o item en la lista nunca cuenta como stock. Al confirmar ticket o cocinar, se invalidan Today y RecipeAvailability como hoy y la lista se refresca desde el servidor sin cambiar el contrato de esas APIs.
21. RPC y tablas nuevas: SECURITY DEFINER con search_path vacío, auth.uid() obligatorio, RLS por usuario en shopping_item_sources, shopping_sessions, shopping_events y mutaciones; REVOKE de public/anon y GRANT solo a authenticated; privilegios mínimos y sin service_role en rutas de usuario. Sin contenido privado ni nombres de alimentos en logs; errores 404 uniformes para ajeno e inexistente.
22. Estados diferenciados con copy y acción propios: cargando, vacío (explica cómo llegan items), error con reintentar, sesión caducada, offline, pendiente de sincronizar, conflicto y revisión de reconciliación. Sin overflow a 320 y 393 px, controles >= 44 px, foco visible y restaurado tras añadir/borrar, secciones como regiones con encabezado, checkbox con nombre accesible y movimiento reducido.
23. UI fiel a la referencia docs/design/neverita-v3/04-shopping-list.png comparada con capturas localhost reales (DB/API reales, mocks de proveedor identificados): tarjetas crema, texto ciruela y acción coral, sin imágenes, precios, cantidades ni tiempos inventados. Las sugerencias se distinguen visualmente de lo decidido y no se cuentan en el total de la lista.
24. Compat. y rollback: PRODUCT_V3=false deja intactos /app/shopping-list, /api/shopping-list, /api/cook/shopping y apply_shopping_list_mutation; las rutas /api/shop/v1/* responden 404 y no escriben. apply_today_shopping_v1 sigue funcionando y sus filas aparecen como recipe_missing con procedencia migrada sin duplicarse. Sin db reset ni backfill destructivo.
25. Fuera de scope: planificación semanal R6, Pro/usage R7, Stripe, proveedores OCR/Whisper/GCS, supermercados externos o precios, y recetas generadas. No se modifica R1 confirm_receipt_draft_v2 ni R4 cooking; los gates humanos pendientes de calidad y smoke real siguen documentados para activación general.
26. Migraciones aditivas aplicadas solo en local y tipos regenerados; sin db reset, seeds remotos, push, despliegue ni SQL remoto como efecto de preparación o implementación. Scope incluye entrypoints de Compra, API shop v1, entrada de ticket y navegación necesarios; frozen install obligatorio si cambia lockfile.
27. Gates del harness (typecheck, lint sin warnings, test, diff-scope), domain typecheck/tests, build, DB lint y pgTAP pasan. Unit/SQL cubren dedupe compatible e incompatible, unknown sin suma, sugerencia suggested/selected/dismissed, idempotencia, replay y payload conflict, RLS con dos usuarios, reconciliación segura/ambigua/parcial, deshacer y atomicidad.
28. Playwright local verifica receta missing a Compra, sugerencia por poco stock aceptada y descartada, alta manual, offline con outbox y reconexión, conflicto entre dos dispositivos, He terminado a /app/scan con sesión, reconciliación segura y ambigua, deshacer, cambio de cuenta y rollback con flag false. Capturas 320/393 con DB/API reales.

