# R6 · propuesta de spec

Preparado el 13 de octubre de 2026. Estado spec_ready; spec_approved=false.
No se ha implementado R6.

# Entrevista · sprint-r6-weekly-planning-layer · Sprint R6 - Lightweight Weekly Planning

- name: `Sprint R6 - Lightweight Weekly Planning`
- estado: **dimensiones cubiertas** → aprueba con `spec.mjs approve sprint-r6-weekly-planning-layer`

## Decisiones registradas

### [data_model] (resuelto)

**R:** meal_entries reutilizada con plan_kind aditiva (meal|outside); recetas planificadas como dinner con snapshot v1 y consumed_at nulo; recipe_id solo catálogo, import:<uuid> en snapshot. Items de Compra con source=plan_missing, source_ref plan:<lunes> y procedencia por entrada. Sin tablas paralelas ni recetas falsas.

### [error_states] (resuelto)

**R:** plan-error-v1 con 401/400/409/503; PLAN_CHANGED conserva la comparación nueva sin escribir; replay antes de validar estado. Offline pendiente no es éxito; conflicto conserva intención. Receta no disponible usa snapshot y avisa; import inválido se excluye con motivo.

### [edge_cases] (resuelto)

**R:** Fecha civil con DST y medianoche; límites de 3 recetas por día y 60 por semana; Cenar fuera excluyente en servidor; misma receta mismo día idempotente; unknown e incompatibles no suman; legacy solo lectura; semana sin entradas; actualizar cantidad solo en items no marcados.

### [auth_secrets] (resuelto)

**R:** auth.uid y RLS de meal_entries intactas; funciones nuevas SECURITY DEFINER con search_path vacío y grants mínimos. Requests sin userId, fechas fuera de rango ni cantidades del cliente; Origin same-origin y JSON estricto; cache private,no-store; 404 uniforme; plan local purgado en logout.

### [external_contracts] (resuelto)

**R:** GET /api/plan/v1/week y POST /api/plan/v1/shop (plan-week-v1, plan-shop-v1); altas y bajas por /api/meals sin cambios; cook_missing_v1 reutilizado para faltantes; contratos R5 de Compra ampliados solo con plan_missing.

### [ui_states] (resuelto)

**R:** /app/cook/week en lista vertical con días como regiones, Sin decidir, Cenar fuera, Registrado antes, selector ¿Cuándo la cocinas? en detalle y CTA Añadir N a la compra. Estados cargando/vacío/error/offline/pendiente/conflicto diferenciados; 320/393 px, 44 px, foco, reduced-motion y referencia 03 sin contenido inventado.

### [rollback_compat] (resuelto)

**R:** PRODUCT_V3=false conserva /app/calendar, /api/meals y Compra legacy; /api/plan/v1 da 404 sin escrituras; selector oculto. plan_kind aditiva con default; datos legacy intactos y legibles. Migraciones locales sin reset; sin R7, proveedores ni cambios a reconciliación de R5.

### [tests] (resuelto)

**R:** Harness, domain, build, DB lint y pgTAP (agregación, unidades, outside, snapshot, idempotencia, PLAN_CHANGED, RLS dos usuarios, legacy). Playwright local con offline real, conflicto entre dispositivos, redirect, zona horaria/DST y rollback; capturas 320/393 con DB/API reales y mocks identificados.

## Cobertura de dimensiones

- ✅ data_model — meal_entries reutilizada con plan_kind aditiva (meal|outside); recetas planificadas como dinner con snapshot v1 y consumed_at nulo; recipe_id solo catálogo, import:<uuid> en snapshot. Items de Compra con source=plan_missing, source_ref plan:<lunes> y procedencia por entrada. Sin tablas paralelas ni recetas falsas.
- ✅ error_states — plan-error-v1 con 401/400/409/503; PLAN_CHANGED conserva la comparación nueva sin escribir; replay antes de validar estado. Offline pendiente no es éxito; conflicto conserva intención. Receta no disponible usa snapshot y avisa; import inválido se excluye con motivo.
- ✅ edge_cases — Fecha civil con DST y medianoche; límites de 3 recetas por día y 60 por semana; Cenar fuera excluyente en servidor; misma receta mismo día idempotente; unknown e incompatibles no suman; legacy solo lectura; semana sin entradas; actualizar cantidad solo en items no marcados.
- ✅ auth_secrets — auth.uid y RLS de meal_entries intactas; funciones nuevas SECURITY DEFINER con search_path vacío y grants mínimos. Requests sin userId, fechas fuera de rango ni cantidades del cliente; Origin same-origin y JSON estricto; cache private,no-store; 404 uniforme; plan local purgado en logout.
- ✅ external_contracts — GET /api/plan/v1/week y POST /api/plan/v1/shop (plan-week-v1, plan-shop-v1); altas y bajas por /api/meals sin cambios; cook_missing_v1 reutilizado para faltantes; contratos R5 de Compra ampliados solo con plan_missing.
- ✅ ui_states — /app/cook/week en lista vertical con días como regiones, Sin decidir, Cenar fuera, Registrado antes, selector ¿Cuándo la cocinas? en detalle y CTA Añadir N a la compra. Estados cargando/vacío/error/offline/pendiente/conflicto diferenciados; 320/393 px, 44 px, foco, reduced-motion y referencia 03 sin contenido inventado.
- ✅ rollback_compat — PRODUCT_V3=false conserva /app/calendar, /api/meals y Compra legacy; /api/plan/v1 da 404 sin escrituras; selector oculto. plan_kind aditiva con default; datos legacy intactos y legibles. Migraciones locales sin reset; sin R7, proveedores ni cambios a reconciliación de R5.
- ✅ tests — Harness, domain, build, DB lint y pgTAP (agregación, unidades, outside, snapshot, idempotencia, PLAN_CHANGED, RLS dos usuarios, legacy). Playwright local con offline real, conflicto entre dispositivos, redirect, zona horaria/DST y rollback; capturas 320/393 con DB/API reales y mocks identificados.

## Scope propuesto

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

## Acceptance propuesto

1. Con PRODUCT_V3=true, /app/cook/week es la vista semanal vertical de 7 días (lunes a domingo, semana del día civil local) dentro de Cocinar, con navegación a semana anterior y siguiente (hasta 8 semanas atrás en solo lectura y 12 adelante) y sin vista mensual. /app/calendar redirige a /app/cook/week conservando solo parámetros seguros; con PRODUCT_V3=false /app/calendar y su API quedan intactos y /app/cook/week redirige a /app/calendar sin escrituras.
2. Almacenamiento: se reutilizan meal_entries y apply_meal_mutation. Migración aditiva: columna plan_kind (meal|outside, por defecto meal) y su restricción de identidad; filas históricas no cambian y siguen legibles. Una receta planificada usa meal_type=dinner, recipe_snapshot versión 1 y consumed_at nulo; recipe_id solo para recetas de catálogo y recipe_snapshot.recipe_id = import:<uuid> para imports privados. No se crean tablas paralelas ni recetas falsas.
3. Desde el detalle de receta de catálogo, import privado y receta guardada aparece ¿Cuándo la cocinas? con Hoy, Mañana y Otro día. Hoy y Mañana guardan con un único toque tras abrir el selector; Otro día abre un selector de fecha nativo accesible y Guardar. El máximo es dos toques tras abrir el selector. La confirmación es honesta (Planeada para <día>) con Deshacer.
4. Hoy y Mañana se calculan con la fecha civil en la zona horaria local del dispositivo y se persisten como YYYY-MM-DD. La aritmética de fechas opera sobre fecha civil (no sobre milisegundos) y es correcta en cambios de hora (25 oct 2026 y 28 mar 2027 en Europe/Madrid) y cerca de medianoche. Una fecha pasada, inválida o a más de 12 semanas se rechaza.
5. Sin decidir es la ausencia de entrada: quitar una receta la borra (soft delete reversible con Deshacer cinco minutos) y un día sin entradas se muestra como Sin decidir. Cenar fuera crea una entrada plan_kind=outside con custom_name fijo y sin recipe_snapshot; no genera ingredientes, requisitos, snapshot ni receta. Sin decidir y Cenar fuera nunca producen faltantes.
6. Un día admite hasta 3 recetas planificadas y la semana hasta 60. Cenar fuera es excluyente con recetas del mismo día: elegirlo pide confirmación y retira las recetas del día con Deshacer. El servidor ignora las recetas de un día con entrada outside al calcular faltantes, aunque otro dispositivo las haya dejado. Programar la misma receta el mismo día es idempotente y no duplica entradas.
7. Entradas históricas o legacy (otros meal_type, consumed_at no nulo, platos con custom_name) se muestran en la semana como Registrado antes, de solo lectura, con enlace a /app/calendar/<id> y a /app/calendar/new, que siguen disponibles. No se borran, reescriben ni cuentan en faltantes. No hay navegación mensual en 1.0.
8. GET /api/plan/v1/week acepta solo from (lunes civil válido) y today (fecha civil dentro de +/-1 día del reloj UTC del servidor) y devuelve plan-week-v1 {from,days:[{date,entries:[{id,kind,title,recipeRef|null,state,version,readOnly}]}],missing:{count,lines,computedAt}}. Cache-Control private,no-store, JSON estricto, Origin same-origin y error plan-error-v1 {error:{code,message,retryable}} con 401 AUTH_REQUIRED,400 INVALID_REQUEST,409 VERSION_CONFLICT|MUTATION_CONFLICT,503 PLAN_UNAVAILABLE. Las altas y bajas reutilizan /api/meals y su contrato sin cambios.
9. Faltantes agregados: el servidor concatena los ingredientes de todas las recetas planificadas desde hoy y los evalúa una sola vez con cook_missing_v1 contra la despensa actual, de modo que dos recetas que necesitan 4 huevos cada una con 6 en stock piden 2. Deduplica por concepto y unidad compatible, no suma cantidades unknown ni unidades incompatibles y no usa fuzzy. Una receta con ingredientes sin resolver los cuenta como Por comprobar y no los añade a Compra.
10. Cada línea de faltante conserva referencias a todas las recetas y días que la requieren {recipe kind/id,title,date,mealEntryId}. Una receta cuyo origen ya no está disponible se evalúa con su snapshot guardado y se marca Usando la versión guardada. Un import inválido o eliminado no rompe la semana: muestra aviso y se excluye del cálculo con motivo.
11. CTA Añadir N a la compra (N = ingredientes distintos por añadir) en la semana. POST /api/plan/v1/shop recibe estrictamente {from,clientMutationId,confirmedKey} donde confirmedKey es la clave de estado de los faltantes mostrados; el servidor recalcula, valida la clave y responde 409 PLAN_CHANGED con la comparación nueva si algo cambió, sin escribir. Devuelve plan-shop-v1 {status:applied|duplicate,itemIds,count}; replay del mismo ID y payload devuelve el resultado original y mismo ID con otro payload da 409 MUTATION_CONFLICT.
12. Los items se crean con source=plan_missing y source_ref plan:<lunes>; shopping_origin, shopping_item_sources y la consolidación de R5 se amplían de forma aditiva. Es idempotente por (usuario, semana, concepto, unidad): reintentar no duplica, y si el faltante cambió actualiza la cantidad solo en items sin marcar ni comprar. Cada item guarda una fila de procedencia por receta/entrada. Compra muestra Falta para tu plan: <receta> (+N más) con enlace de vuelta a la semana.
13. Añadir al plan nunca modifica despensa, cantidades ni lotes, ni consume cuotas Pro/uso. Compra y plan no cuentan como stock: Hoy (R2) y disponibilidad (R3) siguen leyendo solo despensa real. Cocinar (R4) no modifica ni consume entradas del plan; marcar una receta como cocinada no la borra del plan en R6.
14. Offline: la semana ya cargada se lee desde IndexedDB; programar, mover, quitar y marcar Cenar fuera funcionan con el outbox existente neverita-meal-calendar, que ya se purga en cierre de sesión y cambio de cuenta. Los cambios muestran Pendiente, nunca Aplicado, hasta confirmación del servidor; faltantes y Añadir a la compra requieren conexión y lo indican. Conflicto de versión conserva la intención y pide revisión sin sobrescribir.
15. Outbox/IndexedDB de planificación está aislado por usuario y versión de esquema, no comparte almacenamiento con inventario, cocina ni Compra, y no crea bases nuevas fuera de neverita-meal-calendar. Logout o cambio de cuenta cancela requests, oculta y purga el plan local. No hay cache HTTP/SW compartido de datos privados.
16. Seguridad: RPC y funciones nuevas SECURITY DEFINER con search_path vacío y auth.uid() obligatorio, REVOKE de public/anon y GRANT solo a authenticated; RLS de meal_entries y mutaciones intacta. El servidor no acepta userId, fechas fuera de rango, source arbitrario ni cantidades del cliente. 404 uniforme para entradas ajenas. Sin nombres de alimentos ni recetas en logs.
17. Estados diferenciados con copy y acción propios: cargando, semana vacía (explica cómo planificar), error con reintentar, sesión caducada, offline, pendiente, conflicto, receta no disponible y Añadir a la compra aplicado. Cada día es una región con encabezado; controles >= 44 px; foco visible y restaurado tras programar o quitar; movimiento reducido; sin scroll horizontal a 320 y 393 px.
18. UI fiel a docs/design/neverita-v3/03-weekly-planning.png comparada con capturas localhost reales (DB/API reales, mocks identificados): días en lista vertical, huecos Sin decidir visibles, Cenar fuera distinguido, CTA coral al final, sin imágenes, cantidades, calorías ni tiempos inventados. Cocinar enlaza a la semana y la navegación mantiene Cocinar activo en /app/cook/week.
19. Compat. y rollback: PRODUCT_V3=false deja intactos /app/calendar, /api/meals, Compra legacy y el selector no se renderiza; las rutas /api/plan/v1/* responden 404 sin escribir. La columna plan_kind es aditiva y su valor por defecto preserva el comportamiento actual. Sin db reset ni backfill destructivo.
20. Dependencias: R5 (shopping loop) está implementado y pendiente de smoke humano; R6 solo amplía sus contratos de forma aditiva (source plan_missing) y no cambia reconciliación ni sugerencias. Fuera de scope: calendario mensual, comidas consumidas/registro de ingesta, calorías, recomendaciones automáticas, Pro/usage R7, Stripe, proveedores OCR/Whisper/GCS y supermercados externos.
21. Migraciones aditivas aplicadas solo en local y tipos regenerados; sin db reset, seeds remotos, push, despliegue ni SQL remoto como efecto de preparación o implementación. Scope incluye entrypoints de detalle, API plan v1, navegación y el mínimo de Compra necesario para plan_missing; frozen install obligatorio si cambia lockfile.
22. Gates del harness (typecheck, lint sin warnings, test, diff-scope), domain typecheck/tests, build, DB lint y pgTAP pasan. Unit/SQL cubren fecha civil con DST y medianoche, agregación 4+4 huevos con 6 en stock, unidades incompatibles, unknown, outside excluyente, receta no disponible con snapshot, idempotencia, replay, payload conflict, PLAN_CHANGED, RLS con dos usuarios y legacy intacto.
23. Playwright local verifica programar desde receta con Hoy/Mañana/Otro día, semana a 320 y 393, Cenar fuera y Sin decidir, faltantes agregados y Añadir a la compra con procedencia, offline con outbox y reconexión, conflicto entre dispositivos, redirect de /app/calendar, entradas legacy legibles, zona horaria y DST, cambio de cuenta y rollback con flag false.

