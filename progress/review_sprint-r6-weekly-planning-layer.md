# R6 · revisión

13 de octubre de 2026. Pendiente smoke humano antes del cierre mediante
spec.mjs done, conforme a HARNESS.md.

Revisión de contratos estrictos, Origin, RLS, agregación de faltantes con
cook_missing_v1, Cenar fuera excluyente en servidor, legacy de solo lectura,
clave de estado (PLAN_CHANGED), idempotencia por semana y replay. Planificar
nunca escribe despensa. La migración existe solo en local.

Evidencia: docs/design/neverita-v3/qa/R6_COMPARISON.md. pgTAP 435 aserciones
(43 propias), DB lint, web 191, dominio 18, typecheck, lint sin warnings y build
PASS. Playwright v3: cinco recorridos; rollback con --rollback pasa; regresión
R3, R4 y R5 en verde.

## Decisiones y desviaciones del spec aprobado

- POST /api/plan/v1/shop recibe también today (misma fecha civil que el GET) para
  que la clave de estado sea estable cerca de medianoche.
- apply_meal_mutation no cambia: Cenar fuera se clasifica con un trigger sobre
  custom_name. El payload de Cenar fuera omite recipe_snapshot porque un null
  JSON se guardaría como jsonb null y violaría la restricción de identidad.
- Deshacer tras Quitar crea una entrada nueva con el mismo contenido, porque el
  RPC de comidas no tiene restauración.
- La semana lee entradas del caché local de meal_entries (offline) y el cálculo
  de faltantes requiere conexión.

## Checkpoints humanos

- Planificar desde una receta real, revisar la semana en móvil y añadir a Compra.
- Comprobar zona horaria y cambio de hora en un dispositivo real.
- Mantener pendientes los gates humanos de calidad y Whisper/GCS de R3 y el
  smoke de R5.
