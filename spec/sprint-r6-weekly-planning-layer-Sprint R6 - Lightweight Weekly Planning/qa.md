# R6 · QA del spec

Revisión manual de ocho dimensiones y 23 criterios de aceptación.
El CLI instalado no dispone del comando prepare descrito en HARNESS.md;
se preparó entrevista parseable y propuesta durable manualmente. Sin ejecutar
agentes auxiliares, force-ready ni aprobar automáticamente.

Decisiones cerradas: meal_entries y su outbox se reutilizan (el spec original
ya lo pedía); Cenar fuera es plan_kind=outside y excluyente por día en servidor;
los faltantes se agregan concatenando ingredientes y evaluando una sola vez con
cook_missing_v1; plan_missing amplía de forma aditiva los contratos de R5;
Compra requiere clave de estado (PLAN_CHANGED) para no añadir datos obsoletos;
legacy es de solo lectura; sin vista mensual.

Discrepancias respecto al spec original: el scope original no cubría detalle de
receta, navegación, Compra ni calendar legacy; se amplía a esos entrypoints.
R5 está en review_pending (smoke humano sin hacer): R6 depende solo de sus
contratos ya implementados.

Sin ambigüedades bloqueantes. La aprobación seguirá siendo explícita.
