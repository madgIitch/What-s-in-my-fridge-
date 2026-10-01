# sprint-r2-today-decision-engine · Sprint R2 - Hoy & Decision Engine — Diseño

## Scope (archivos que puede tocar)

- `apps/web/src/app/(auth)/app/page.tsx`
- `apps/web/src/components/today/**`
- `apps/web/src/lib/recommendations/**`
- `apps/web/src/app/api/recommendations/**`
- `apps/web/src/styles/product-v3.css`
- `apps/web/src/types/database.generated.ts`
- `packages/domain/src/recommendations/**`
- `packages/domain/src/recipes/**`
- `packages/domain/src/pantry/**`
- `packages/domain/src/index.ts`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/**`
- `docs/**`
- `spec.json`

## Enfoque

- **data_model:** Reutilizar PantryItemKnowledge, food_concepts, recetas/ingredientes del catálogo activo y favoritos propios. Proyección conservadora en lectura: concepto explícito o alias exacto único; nunca fuzzy ni backfill automático. Cache v3 privada y separada de v1. Nuevos campos/tablas/RPC solo aditivos; sin resets. R2 no indexa snapshots privados/importados aún sin contrato de catálogo (R3).
- **external_contracts:** GET /api/recommendations/today?date=YYYY-MM-DD devuelve contrato today-v2 con main<=3, secondary<=3, availability/reasons/missing/unknown, snapshotKey opaca, versiones y estados explícitos. date sirve solo para fecha civil; no ownership. POST /api/recommendations/shopping {recipeId,snapshotKey,clientMutationId} recalcula faltantes de servidor; snapshot cambiado=409, replay devuelve mismos IDs. Nunca invocar begin_recipe_suggestion/consume_usage de v1. CTA Cocinar esto abre detalle existente, sin consumir stock ni iniciar sesión de cocina R4.
- **edge_cases:** Eliminar tombstones/empty/quantity=0 de disponibilidad; legacy conserva precisión desconocida. Agrupar ingredientes por concepto y sumar requerimientos exactos compatibles antes de comparar; sumar existencias exactas compatibles una sola vez. g/kg y ml/l convertibles; pack/unit/volumen/peso no se mezclan. Ingredientes ambiguos permanecen unknown; nunca contar un desconocido como faltante demostrado. No presumir sal/aceite básicos ni sustituir alimentos. Fecha civil local y cantidades de receta sin escalado de raciones.
- **ui_states:** PRODUCT_V3=true convierte /app en Hoy automático. Referencias 06/10, tokens R0/R1. Máximo tres decisiones principales compactas: primera tarjeta y CTA visibles a 393x852 antes de bloques secundarios; no exigir que tres tarjetas completas quepan. Onboarding saltables solo en cuenta sin items activos y no visto por ese usuario/dispositivo. Ejemplo explícito aislado sin datos escritos. Empty enlaza a /app/add-purchase y /app/recipes/import. Error/offline honestos; teclado, 44px, foco, reduced motion y sin overflow a320.

## Decisiones de la entrevista

- **data_model:** Reutilizar PantryItemKnowledge, food_concepts, recetas/ingredientes del catálogo activo y favoritos propios. Proyección conservadora en lectura: concepto explícito o alias exacto único; nunca fuzzy ni backfill automático. Cache v3 privada y separada de v1. Nuevos campos/tablas/RPC solo aditivos; sin resets. R2 no indexa snapshots privados/importados aún sin contrato de catálogo (R3).
- **error_states:** Distinguir despensa vacía, sin conceptos utilizables, sin candidatos, catálogo ausente, error de lectura y desconexión. No fabricar recomendaciones. Retry explícito; conservar resultado anterior solo con etiqueta de antigüedad. Compra requiere red y confirmación explícita, transacción atómica y replay. Sin cuota de negocio para Hoy; límites técnicos antiabuso no consumen usage.
- **edge_cases:** Eliminar tombstones/empty/quantity=0 de disponibilidad; legacy conserva precisión desconocida. Agrupar ingredientes por concepto y sumar requerimientos exactos compatibles antes de comparar; sumar existencias exactas compatibles una sola vez. g/kg y ml/l convertibles; pack/unit/volumen/peso no se mezclan. Ingredientes ambiguos permanecen unknown; nunca contar un desconocido como faltante demostrado. No presumir sal/aceite básicos ni sustituir alimentos. Fecha civil local y cantidades de receta sin escalado de raciones.
- **auth_secrets:** Sesión/RLS delimitan inventario, favoritos, cache y compra. El request no acepta usuario, inventario, plan ni scores. Cache HTTP privada no-store; no cache SW compartido. Logout/cambio de usuario descarta respuesta y datos de Hoy. Sin LLM ni nuevas credenciales. TTMD solo IDs de evento/sesión efímeros y tiempos; sin userId, nombres, recetas, inventario, hash ni texto privado.
- **external_contracts:** GET /api/recommendations/today?date=YYYY-MM-DD devuelve contrato today-v2 con main<=3, secondary<=3, availability/reasons/missing/unknown, snapshotKey opaca, versiones y estados explícitos. date sirve solo para fecha civil; no ownership. POST /api/recommendations/shopping {recipeId,snapshotKey,clientMutationId} recalcula faltantes de servidor; snapshot cambiado=409, replay devuelve mismos IDs. Nunca invocar begin_recipe_suggestion/consume_usage de v1. CTA Cocinar esto abre detalle existente, sin consumir stock ni iniciar sesión de cocina R4.
- **ui_states:** PRODUCT_V3=true convierte /app en Hoy automático. Referencias 06/10, tokens R0/R1. Máximo tres decisiones principales compactas: primera tarjeta y CTA visibles a 393x852 antes de bloques secundarios; no exigir que tres tarjetas completas quepan. Onboarding saltables solo en cuenta sin items activos y no visto por ese usuario/dispositivo. Ejemplo explícito aislado sin datos escritos. Empty enlaza a /app/add-purchase y /app/recipes/import. Error/offline honestos; teclado, 44px, foco, reduced motion y sin overflow a320.
- **rollback_compat:** Flag ausente/false conserva /app InventoryApp, endpoint y cuota legacy v1 y navegación v2. API v3 responde404 con flagfalse. Sin cambios OCR, import, billing, cooking, planificación, proveedores, Pro ni R3-R8. No despliegue/activación ni reset/backfill destructivo. Compras reutilizan semántica actual; procedencia y agrupación avanzada quedan R5.
- **tests:** Unit domain para presencia/cantidad/unidades/dedup/ranking/frescura/cache; web para contrato, errores, onboarding y métricas; SQL/RLS dos usuarios, compra atómica/replay, permisos, cache y usage invariable. Playwright con DB local: ready/quantity_to_check/missing_one/missing_many/unknown/empty, estimates, Free agotado, compras, dos usuarios y flagfalse. Capturas reales320/393 y comparación06/10. Gates harness, domain typecheck/tests, build, DB lint/pgTAP, instalación frozen si cambia lockfile. Smoke real pendiente R1 no se presenta como completado.

