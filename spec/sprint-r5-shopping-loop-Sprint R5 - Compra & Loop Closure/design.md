# sprint-r5-shopping-loop · Sprint R5 - Compra & Loop Closure — Diseño

## Scope (archivos que puede tocar)

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

## Enfoque

- **data_model:** shopping_list_items ampliada de forma aditiva (source, food_concept_id, selection, purchased_at, purchase_ref, shopping_session_id); shopping_item_sources para procedencia múltiple; shopping_sessions y shopping_events append-only para reconciliación y deshacer. Sugerencias persistidas como selection=suggested, nunca stock. checked (tienda) y purchased (ticket) son estados distintos.
- **external_contracts:** GET /api/shop/v1/list y POST /api/shop/v1/mutations (shopping-list-v1, shopping-mutation-v1); RPC reconcile_shopping_after_receipt_v1 invocada tras ticket confirmado; enlace /app/scan?shoppingSession=<UUID>. Contratos R1 confirm_receipt_draft_v2, R2 apply_today_shopping_v1 y legacy apply_shopping_list_mutation no cambian.
- **edge_cases:** Dedupe solo con concepto y unidad compatibles; unknown, pack/unit y peso/volumen no se suman. Sin concepto solo fusiona nombre normalizado idéntico. Stock exacto no genera sugerencias; descartada no resucita con la misma versión. Receta origen borrada, ticket abandonado, ticket sin sesión, cobertura parcial, múltiples candidatos y item checked sin ticket quedan definidos.
- **ui_states:** /app/shop con tres secciones, alta rápida, detalle explicativo por item, CTA He terminado y Revisar compra tras ticket. Estados cargando/vacío/error/offline/pendiente/conflicto diferenciados; 320/393 px, 44 px, foco, reduced-motion y referencia 04-shopping-list.png sin contenido inventado.

## Decisiones de la entrevista

- **data_model:** shopping_list_items ampliada de forma aditiva (source, food_concept_id, selection, purchased_at, purchase_ref, shopping_session_id); shopping_item_sources para procedencia múltiple; shopping_sessions y shopping_events append-only para reconciliación y deshacer. Sugerencias persistidas como selection=suggested, nunca stock. checked (tienda) y purchased (ticket) son estados distintos.
- **error_states:** shopping-error-v1 con 401/400/404/409/503. Replay antes de validar estado; conflicto de versión conserva intención. Reconciliación falla cerrada y nunca autocierra ambiguos. Offline pendiente no es éxito. Deshacer con ventana de cinco minutos y versiones estrictas, sin restauración parcial.
- **edge_cases:** Dedupe solo con concepto y unidad compatibles; unknown, pack/unit y peso/volumen no se suman. Sin concepto solo fusiona nombre normalizado idéntico. Stock exacto no genera sugerencias; descartada no resucita con la misma versión. Receta origen borrada, ticket abandonado, ticket sin sesión, cobertura parcial, múltiples candidatos y item checked sin ticket quedan definidos.
- **auth_secrets:** auth.uid y RLS en todas las tablas nuevas; SECURITY DEFINER con search_path vacío y grants mínimos. Requests sin userId ni source arbitrario; Origin same-origin y JSON estricto; cache private,no-store; 404 uniforme. Logout purga cache y outbox de Compra. Sin datos privados en logs.
- **external_contracts:** GET /api/shop/v1/list y POST /api/shop/v1/mutations (shopping-list-v1, shopping-mutation-v1); RPC reconcile_shopping_after_receipt_v1 invocada tras ticket confirmado; enlace /app/scan?shoppingSession=<UUID>. Contratos R1 confirm_receipt_draft_v2, R2 apply_today_shopping_v1 y legacy apply_shopping_list_mutation no cambian.
- **ui_states:** /app/shop con tres secciones, alta rápida, detalle explicativo por item, CTA He terminado y Revisar compra tras ticket. Estados cargando/vacío/error/offline/pendiente/conflicto diferenciados; 320/393 px, 44 px, foco, reduced-motion y referencia 04-shopping-list.png sin contenido inventado.
- **rollback_compat:** PRODUCT_V3=false conserva /app/shopping-list y APIs legacy; /api/shop/v1 da 404 sin escrituras. Filas legacy y de Today migran como legacy/recipe_missing sin pérdida ni duplicados. Migraciones solo locales aditivas; sin R6/R7, proveedores ni cambios a R1/R4.
- **tests:** Harness, domain, build, DB lint y pgTAP (RLS dos usuarios, idempotencia, atomicidad, reconciliación, deshacer). Playwright local con offline real, conflicto entre dispositivos, ticket y rollback; capturas 320/393 con DB/API reales y mocks de proveedor identificados.

