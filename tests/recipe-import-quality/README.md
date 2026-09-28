# Evaluación aislada de fidelidad

`node --test tests/recipe-import-quality/evaluate.test.mjs` verifica el evaluador, no la calidad de los modelos.

`node tests/recipe-import-quality/evaluate.mjs <referencia-privada.json> <salida-privada.json>` imprime solo métricas. No usa red, DB ni cuota.

Referencia: `{annotatedBy:"human", transcript:"...", ingredients:[{name,aliases?,amount?,unit?}], allowedNumericFacts:["2"]}`. La salida lleva ingredients/steps y opcionalmente transcript. Ausencia de cantidades explícitas da accuracy `null`, nunca 100%. Los aliases se anotan antes de evaluar.

`corpus.json` fija los 8 casos de desarrollo y 4 de evaluación. Es un manifiesto pendiente de selección/anotación, no evidencia de aprobación del benchmark. Faltan archivos privados, hashes y etiquetas humanas; no entrenar ni ajustar con los cuatro casos reservados.

La evaluación automática de números es una alarma básica: no demuestra contexto correcto, operaciones ni gramática. Anotar por separado cero frases no culinarias y orden/fidelidad de los pasos mediante revisión humana. No activar el flag de calidad hasta completar todos los criterios del spec.
