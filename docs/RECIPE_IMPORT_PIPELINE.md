# Pipeline de importación de recetas

La PWA normaliza paste, Web Share Target, texto y referencias de upload en `createRecipeImportJob`. El RPC de Supabase crea el job y consume cuota en una sola transacción; Vercel solo envía `{jobId}` a Cloud Tasks y responde. El worker privado de Cloud Run reclama un lease, intenta texto estructurado/HTML antes de media, usa ffmpeg y `whisper-service` solo si el texto es insuficiente, llama a `ollama-service` para structured output y completa el job únicamente después de validar `recipe-v1`.

La fuente de verdad es `recipe_import_jobs`; Realtime puede acelerar la UI, pero GET/polling recupera cualquier estado tras recargar. Un redelivery observa `completed`, un lease vigente o reclama un job expirado. Los errores almacenan códigos seguros, nunca contenido ni tokens.

Los imports URL no usan GCS. El bucket temporal admite únicamente uploads/spool bajo prefijos por usuario/job, tiene TTL de un día y cleanup idempotente. Para rollback se pausan `recipe-imports` y se desactivan flags; los jobs y recetas existentes siguen legibles.
