# Implementación de calidad de recetas — en curso

Spec aprobada por peorr. Implementación detrás de flags apagados, no certificada para activar todavía.

## Trabajo verificado

- Reproducción aislada del reel: yt-dlp + ffmpeg + Whisper + dos llamadas reales a Ollama. Sin escrituras al job real ni consumo de cuota.
- ASR actual: español, 7 segmentos, 123 palabras, 17.24 s. Caption 40 caracteres; transcripción 646 caracteres.
- Extracción baseline: 136.56 s, 4 ingredientes, 7 pasos. Nueva extracción con evidencia: 241.04 s, 4 ingredientes, 9 pasos candidatos; validación conserva 5 pasos y omite cantidades sin soporte. Esta medición aislada no es p95 ni certifica ejecución warm.
- La transcripción reproduce diálogo no culinario y términos vagos. No se ha calculado WER/fidelidad sin referencia humana.
- Conservar caption + ASR, recuperar subtítulos VTT cuando están disponibles, evaluar cobertura y delimitar fuentes no confiables.
- Structured extraction con schema, referencias a evidencia, temperatura 0/seed 42; validaciones conservadoras y estado de revisión obligatorio mientras falta benchmark.
- Contrato ASR v2 compatible, modelo CPU configurable base/small y segmentos con señales; no se ha cambiado el modelo desplegado.
- Deadline 540 s compartido entre subprocesses/proveedores/red/DB; máximo dos llamadas de extracción. Cleanup con TTL de emergencia.
- Historial aditivo/RLS/CAS: edición propia, restauración, reproceso explícito idempotente con límite 3/h sin cuota y candidato separado. Uploads expirados se rechazan sin inventar recuperación.
- UI con fuente original, cantidad desconocida, aviso, editor/restauración y aceptación de candidato.
- Evaluador offline y manifiesto de 12 casos con split 8/4; pendientes selección, anotación y hashes. No son un corpus humano terminado.
- Worker 29 tests, Python 8, evaluador 3; SQL/RLS 190 pruebas. Smoke Playwright Chrome móvil de edición/restauración pasa. Gates (typecheck, lint, test, scope) y build de producción pasan. Archivos privados de la reproducción temporal eliminados tras registrar las métricas.

## Pendiente antes de activar o cerrar

1. Referencia humana del reel y resto del corpus; pregunta enviada al usuario. No tratar resultados del modelo como etiquetas humanas.
2. Evaluar candidato ASR small y variante de audio; benchmarks sobre recursos Cloud Run, 20 ejecuciones, métricas de memoria y p95/cold separado.
3. Calibrar verificación semántica/contradicciones, unidades, cantidades escritas y avisos sobre segmentos inciertos. Las reglas implementadas detectan señales, no prueban fidelidad completa.
4. Completar matriz de rate-limit/concurrencia/reintentos/reproceso y smoke móvil en WebKit/Firefox; auditar reconciliación de enqueue.
5. Canary y rollout coordinado de flags/servicios tras superar todos los criterios. La receta de producción original permanece intacta.
