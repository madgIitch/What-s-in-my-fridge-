# sprint-7-url-recipe-import-jobs · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [x] (T1) YouTube, Instagram, TikTok, blog, manual y file upload convergen en `createRecipeImportJob` y conservan sourceType/provenance.  ↔ R1
- [x] (T2) La PWA instalada actúa como share target donde exista soporte; pegar URL cubre el flujo completo como fallback universal.  ↔ R2
- [x] (T3) La request interactiva responde después de persistir y encolar, sin esperar descarga, ffmpeg, Whisper ni LLM.  ↔ R3
- [x] (T4) Vercel no descarga/transcodifica medios ni ejecuta Whisper/ffmpeg en el flujo normal.  ↔ R4
- [x] (T5) Cloud Tasks entrega solo `jobId` mediante OIDC a `neverita-media-worker`, que rechaza llamadas no autorizadas.  ↔ R5
- [x] (T6) El worker nuevo usa `whisper-service` mediante `TranscriptionProvider` y `ollama-service` mediante `RecipeExtractionProvider`; los endpoints son configuración de servidor.  ↔ R6
- [x] (T7) Una misma idempotency key no consume dos cuotas, no crea dos jobs lógicos y redelivery no duplica una receta completada.  ↔ R7
- [x] (T8) Con transcript/caption/texto suficiente, las métricas prueban que Whisper no se invoca.  ↔ R8
- [x] (T9) Sin texto suficiente, el worker obtiene audio, ffmpeg produce el formato esperado y Whisper transcribe antes de extracción.  ↔ R9
- [x] (T10) Una URL normal no sube vídeo a GCS; GCS solo se usa para upload/temp spool y sus objetos expiran mediante lifecycle y cleanup idempotente.  ↔ R10
- [x] (T11) El proveedor de extracción devuelve Recipe structured output; Zod/JSON Schema valida título, ingredientes y pasos antes de completed.  ↔ R11
- [x] (T12) Una salida inválida no se persiste como receta: se intenta repair/retry acotado y después failed con código seguro.  ↔ R12
- [x] (T13) Todos los estados son recuperables desde Supabase tras cerrar la PWA o perder Realtime.  ↔ R13
- [x] (T14) Errores de download, Whisper o extracción dejan un job reconciliable sin corromper recetas, inventario ni cuota.  ↔ R14
- [x] (T15) SSRF tests bloquean localhost, RFC1918, link-local, metadata endpoints, redirects privados y DNS rebinding observable.  ↔ R15
- [x] (T16) El resultado conserva schemaVersion, title, ingredients, steps, source y provenance; raw text/transcript se minimiza según política.  ↔ R16
- [x] (T17) Free dispone de 10 imports mensuales y Pro activo omite el límite, siempre aplicado server-side.  ↔ R17
- [x] (T18) Feature flags permiten desactivar por fuente, archivo, Whisper o extracción sin afectar recetas existentes.  ↔ R18
- [x] (T19) Tests cubren share target, paste, file, caption sin Whisper, fallback Whisper, schema inválido, retry/redelivery, doble submit, concurrencia, recuperación, SSRF y cleanup.  ↔ R19
- [ ] (T20) Typecheck, lint, unit/integration, build, worker container tests, pgTAP/RLS y Playwright móvil pasan con código 0.  ↔ R20
- [ ] Tests que cubran los criterios de aceptación
