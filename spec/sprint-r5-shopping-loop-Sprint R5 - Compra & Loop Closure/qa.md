# R5 · QA del spec

Revisión manual de ocho dimensiones y 28 criterios de aceptación.
El CLI instalado no dispone del comando prepare descrito en HARNESS.md;
se preparó entrevista parseable y propuesta durable manualmente. Sin ejecutar
agentes auxiliares, force-ready ni aprobar automáticamente.

Decisiones cerradas: /app/shop canónica y /app/shopping-list redirige solo con
flag; el ticket vigente es /app/scan (no existe /app/add-purchase/ticket) y se
pasa shoppingSession; reconciliación en RPC separada para no tocar el contrato
R1; sugerencias solo de stock cualitativo low/empty, persistidas como
suggested; checked (tienda) distinto de purchased (ticket); ambiguos nunca se
autocierran; deshacer cinco minutos con versiones estrictas.

Discrepancias detectadas respecto al spec original: ruta /app/shop vs
/app/shopping-list existente y ruta de ticket inexistente. Ambas resueltas en
los criterios 1 y 15. Scope ampliado solo para entrypoints, navegación y scan.

Sin ambigüedades bloqueantes. La aprobación seguirá siendo explícita.
