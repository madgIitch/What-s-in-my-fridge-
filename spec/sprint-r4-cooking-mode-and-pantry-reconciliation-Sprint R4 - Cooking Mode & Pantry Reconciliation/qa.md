# R4 · QA del spec

Revisión manual de ocho dimensiones y 31 criterios de aceptación.
El CLI instalado no dispone del comando prepare descrito en HARNESS.md;
se preparó entrevista parseable y propuesta durable manualmente. Sin ejecutar
agentes auxiliares, force-ready ni aprobar automáticamente.

Decisiones cerradas: fuente favorita inmutable; unknown no resta; consumo
manualmente ajustado queda user_adjustment; selección explícita de lote para
cualitativo; stock insuficiente no se satura; undo cinco minutos con versiones
estrictas y compensación única; offline reenvía el mismo payload y exige nueva
confirmación si el plan expira. Requests, responses, estados y errores definidos.
Scope ampliado solo para entrypoints, API v3 y tipos necesarios.

Sin ambigüedades bloqueantes detectadas en esta revisión. La aprobación
seguirá siendo explícita; benchmarks/smoke externos de R3 no se dan por hechos.
