# sprint-7-url-recipe-import-jobs · undefined — Diseño

## Scope (archivos que puede tocar)

- `apps/web/src/app/(auth)/app/recipes/import/**`
- `apps/web/src/app/api/recipe-jobs/**`
- `apps/web/src/app/api/share-target/**`
- `apps/web/src/app/manifest.ts`
- `apps/web/public/manifest.webmanifest`
- `apps/web/src/components/recipe-import/**`
- `apps/web/src/lib/recipe-import/**`
- `packages/domain/src/recipe-jobs/**`
- `packages/domain/src/recipes/**`
- `services/media-worker/**`
- `infrastructure/gcp/cloud-run/**`
- `infrastructure/gcp/cloud-tasks/**`
- `infrastructure/gcp/storage/**`
- `supabase/**`
- `tests/**`
- `docs/**`
- `.env.example`
- `vercel.json`
- `spec.json`

## Decisiones de la entrevista

- **data_model:** `recipe_jobs` es la fuente autoritativa en Supabase y conserva usuario, source type/url, idempotency key, estados, attempts, lease, resultado versionado y error seguro. Los artefactos binarios viven únicamente en un bucket temporal por prefijo de job; una receta se persiste solo después de validar el schema.
- **error_states:** Estados: queued, fetching, transcribing, extracting, validating, completed, failed y cancelled. Errores externos se traducen a códigos estables y retryable; redelivery, doble submit y workers concurrentes no duplican consumo, jobs ni recetas.
- **edge_cases:** Se priorizan JSON-LD, HTML, descripción, captions y transcript. Whisper se invoca solo cuando el texto útil sea insuficiente. URLs bloqueadas, redirects privados, archivos demasiado grandes, duración excesiva, texto insuficiente y salida LLM inválida terminan de forma controlada y permiten fallback manual.
- **auth_secrets:** Vercel crea Cloud Tasks con payload mínimo `jobId`. Cloud Tasks llama mediante OIDC a un worker privado nuevo `neverita-media-worker` usando una cuenta dedicada `neverita-tasks`; no se reutiliza `neverita-vision`. Secretos se inyectan en runtime y nunca se incluyen en imagen, payload, logs o navegador.
- **external_contracts:** El worker nuevo orquesta el pipeline y usa el Cloud Run existente `whisper-service` mediante `TranscriptionProvider`. La extracción estructurada usa otro adapter desacoplado, inicialmente el `ollama-service` existente. Ambos endpoints se configuran por entorno y pueden reemplazarse sin cambiar jobs/UI. Cloud Tasks, Cloud Run y GCS se crean en `europe-west1` bajo `what-s-in-my-fridge-a2a07`.
- **ui_states:** Paste URL, texto manual, Web Share Target y archivo convergen en la misma pantalla/contrato. La UI muestra envío, progreso recuperable, completado, fallo retryable, cancelado y fallback manual; cerrar o recargar la pestaña no pierde el resultado.
- **rollback_compat:** Migraciones y rutas son aditivas. Feature flags permiten apagar fuentes, archivo, Whisper o LLM. Rollback despliega la versión anterior, pausa la cola y conserva jobs/recetas; el cleanup temporal es idempotente.
- **tests:** Unit/integration cubren detección de fuente, SSRF, schema, idempotencia, cuotas, extraction ladder y adapters. pgTAP cubre RLS/carreras; tests del worker cubren OIDC/redelivery; Playwright móvil cubre paste/share/file, recuperación y estados.

