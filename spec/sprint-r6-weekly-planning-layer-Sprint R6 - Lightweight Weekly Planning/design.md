# sprint-r6-weekly-planning-layer · Sprint R6 - Lightweight Weekly Planning — Diseño

## Scope (archivos que puede tocar)

- `apps/web/src/app/(auth)/app/cook/week/**`
- `apps/web/src/app/(auth)/app/cook/page.tsx`
- `apps/web/src/app/(auth)/app/calendar/page.tsx`
- `apps/web/src/app/(auth)/app/recipes/[id]/**`
- `apps/web/src/app/(auth)/app/recipes/import/**`
- `apps/web/src/app/api/plan/v1/**`
- `apps/web/src/components/planning/**`
- `apps/web/src/components/cook/**`
- `apps/web/src/components/navigation/**`
- `apps/web/src/components/shop/**`
- `apps/web/src/lib/meal-calendar/**`
- `apps/web/src/lib/planning/**`
- `apps/web/src/lib/shop/**`
- `apps/web/src/types/database.generated.ts`
- `packages/domain/src/meals/**`
- `packages/domain/src/planning/**`
- `packages/domain/src/shopping-list/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/**`
- `docs/**`
- `spec.json`

## Enfoque

- **data_model:** meal_entries reutilizada con plan_kind aditiva (meal|outside); recetas planificadas como dinner con snapshot v1 y consumed_at nulo; recipe_id solo catálogo, import:<uuid> en snapshot. Items de Compra con source=plan_missing, source_ref plan:<lunes> y procedencia por entrada. Sin tablas paralelas ni recetas falsas.
- **external_contracts:** GET /api/plan/v1/week y POST /api/plan/v1/shop (plan-week-v1, plan-shop-v1); altas y bajas por /api/meals sin cambios; cook_missing_v1 reutilizado para faltantes; contratos R5 de Compra ampliados solo con plan_missing.
- **edge_cases:** Fecha civil con DST y medianoche; límites de 3 recetas por día y 60 por semana; Cenar fuera excluyente en servidor; misma receta mismo día idempotente; unknown e incompatibles no suman; legacy solo lectura; semana sin entradas; actualizar cantidad solo en items no marcados.
- **ui_states:** /app/cook/week en lista vertical con días como regiones, Sin decidir, Cenar fuera, Registrado antes, selector ¿Cuándo la cocinas? en detalle y CTA Añadir N a la compra. Estados cargando/vacío/error/offline/pendiente/conflicto diferenciados; 320/393 px, 44 px, foco, reduced-motion y referencia 03 sin contenido inventado.

## Decisiones de la entrevista

- **data_model:** meal_entries reutilizada con plan_kind aditiva (meal|outside); recetas planificadas como dinner con snapshot v1 y consumed_at nulo; recipe_id solo catálogo, import:<uuid> en snapshot. Items de Compra con source=plan_missing, source_ref plan:<lunes> y procedencia por entrada. Sin tablas paralelas ni recetas falsas.
- **error_states:** plan-error-v1 con 401/400/409/503; PLAN_CHANGED conserva la comparación nueva sin escribir; replay antes de validar estado. Offline pendiente no es éxito; conflicto conserva intención. Receta no disponible usa snapshot y avisa; import inválido se excluye con motivo.
- **edge_cases:** Fecha civil con DST y medianoche; límites de 3 recetas por día y 60 por semana; Cenar fuera excluyente en servidor; misma receta mismo día idempotente; unknown e incompatibles no suman; legacy solo lectura; semana sin entradas; actualizar cantidad solo en items no marcados.
- **auth_secrets:** auth.uid y RLS de meal_entries intactas; funciones nuevas SECURITY DEFINER con search_path vacío y grants mínimos. Requests sin userId, fechas fuera de rango ni cantidades del cliente; Origin same-origin y JSON estricto; cache private,no-store; 404 uniforme; plan local purgado en logout.
- **external_contracts:** GET /api/plan/v1/week y POST /api/plan/v1/shop (plan-week-v1, plan-shop-v1); altas y bajas por /api/meals sin cambios; cook_missing_v1 reutilizado para faltantes; contratos R5 de Compra ampliados solo con plan_missing.
- **ui_states:** /app/cook/week en lista vertical con días como regiones, Sin decidir, Cenar fuera, Registrado antes, selector ¿Cuándo la cocinas? en detalle y CTA Añadir N a la compra. Estados cargando/vacío/error/offline/pendiente/conflicto diferenciados; 320/393 px, 44 px, foco, reduced-motion y referencia 03 sin contenido inventado.
- **rollback_compat:** PRODUCT_V3=false conserva /app/calendar, /api/meals y Compra legacy; /api/plan/v1 da 404 sin escrituras; selector oculto. plan_kind aditiva con default; datos legacy intactos y legibles. Migraciones locales sin reset; sin R7, proveedores ni cambios a reconciliación de R5.
- **tests:** Harness, domain, build, DB lint y pgTAP (agregación, unidades, outside, snapshot, idempotencia, PLAN_CHANGED, RLS dos usuarios, legacy). Playwright local con offline real, conflicto entre dispositivos, redirect, zona horaria/DST y rollback; capturas 320/393 con DB/API reales y mocks identificados.

