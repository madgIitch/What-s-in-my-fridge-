# Revisión administrativa · improve-recipe-import-quality

Estado: cierre administrativo solicitado por el usuario el 28 de septiembre de 2026. No equivale a aceptación de fidelidad ni autoriza un rollout general.

## Evidencia disponible

- Pipeline con extracción basada en evidencia, cantidades desconocidas, revisiones de receta y flujo de edición implementado. Detalles y digests de despliegue en `progress/impl_improve-recipe-import-quality.md`.
- Typecheck y lint de la PWA pasan. La suite completa pasó al repetirla: 32 archivos, 132 tests. Una primera ejecución falló de forma intermitente en `receipt-scanner.accessibility.test.tsx`; el caso aislado y la repetición completa pasaron.
- Pruebas del worker, Python, SQL/RLS y smoke de edición/restauración ya registradas en el progreso de implementación.

## Criterios pendientes

- Referencia humana y corpus anotado de 12 casos, con benchmark de fidelidad de ingredientes, cantidades y pasos.
- Evaluación comparativa de ASR y audio, 20 ejecuciones warm, memoria y p95/cold en Cloud Run.
- Calibración de contradicciones y unidades, matriz de concurrencia/reintentos y smoke móvil WebKit/Firefox.
- Canary y rollout coordinado de flags web. La fidelidad del job real no está validada; la edición y el reproceso web siguen apagados.

Estos pendientes se conservan como deuda explícita para el puente de importación de R3. El cierre permite comenzar R0 sin presentar la calidad de las recetas importadas como certificada.
