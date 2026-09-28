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

### Incidencia de la prueba en producción (28 septiembre)

El job `5d058b36-2bdb-4492-86f8-49cfd61981af` terminó en un intento sin error del worker, pero la pantalla mostraba «No pudimos leer la receta». El resultado `recipe-v1` tenía 4 ingredientes y 5 pasos válidos; los campos opcionales `amount` y `unit` llegaron como JSON `null`. El validador web solo aceptaba `undefined` o texto. Se admite `null` como medida desconocida y se añade regresión. No se modifica el job original ni se declara validada la fidelidad del contenido.

### Despliegue de prueba solicitado por el usuario (28 septiembre)

El usuario pidió desplegar la extracción nueva para probarla. Whisper `whisper-service-00008-mcp` sirve el 100 % con digest `sha256:3f672802b3c689eb9d5f6e415cf4e559b662dd6faea793e620ec6b6fd08ca487`; smoke con el reel: `transcription-v2`, modelo `base`, idioma `es`, 7 segmentos, sin error. El worker `neverita-media-worker-00009-win` sirve el 100 % con digest `sha256:ad402ccd8607a030040442bba5d7bab6c526172649f3732f0454b84cee3c444b` y `RECIPE_IMPORT_QUALITY_ENABLED=true`. Una tarea OIDC firmada hacia la revisión etiquetada devolvió 204 sobre un job ya completado, sin modificarlo. La migración de revisiones está aplicada. Las flags web de edición/reproceso siguen sin activar; el conector de Vercel devuelve 403 para el scope del proyecto. Primer job nuevo y fidelidad aún pendientes de observar.

Este despliegue es una prueba dirigida por el usuario, no aceptación del benchmark ni cierre del spec. Los resultados nuevos se marcan `review_required`. Rollback de tráfico: worker `neverita-media-worker-00007-zaw`; Whisper `whisper-service-00006-nem`. No borrar datos históricos.

1. Referencia humana del reel y resto del corpus; pregunta enviada al usuario. No tratar resultados del modelo como etiquetas humanas.
2. Evaluar candidato ASR small y variante de audio; benchmarks sobre recursos Cloud Run, 20 ejecuciones, métricas de memoria y p95/cold separado.
3. Calibrar verificación semántica/contradicciones, unidades, cantidades escritas y avisos sobre segmentos inciertos. Las reglas implementadas detectan señales, no prueban fidelidad completa.
4. Completar matriz de rate-limit/concurrencia/reintentos/reproceso y smoke móvil en WebKit/Firefox; auditar reconciliación de enqueue.
5. Canary y rollout coordinado de flags/servicios tras superar todos los criterios. La receta de producción original permanece intacta.
