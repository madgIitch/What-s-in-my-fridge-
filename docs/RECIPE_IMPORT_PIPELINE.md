# Pipeline de importación de recetas

La PWA normaliza paste, Web Share Target, texto y referencias de upload en `createRecipeImportJob`. El RPC de Supabase crea el job y consume cuota en una sola transacción; Vercel solo envía `{jobId}` a Cloud Tasks y responde. El worker privado de Cloud Run reclama un lease, intenta texto estructurado/HTML antes de media, usa ffmpeg y `whisper-service` solo si el texto es insuficiente, llama a `ollama-service` para structured output y completa el job únicamente después de validar `recipe-v1`.

La fuente de verdad es `recipe_import_jobs`; Realtime puede acelerar la UI, pero GET/polling recupera cualquier estado tras recargar. Un redelivery observa `completed`, un lease vigente o reclama un job expirado. Los errores almacenan códigos seguros, nunca contenido ni tokens.

Los imports URL no usan GCS. El bucket temporal admite únicamente uploads/spool bajo prefijos por usuario/job, tiene TTL de un día y cleanup idempotente. Para rollback se pausan `recipe-imports` y se desactivan flags; los jobs y recetas existentes siguen legibles.

El worker instala una versión exacta de `yt-dlp` desde PyPI en vez de depender del paquete de Debian. Su `stderr` solo se procesa en memoria para clasificar fallos estables (`YTDLP_AUTH_REQUIRED`, `YTDLP_UNSUPPORTED`, `YTDLP_UNAVAILABLE`, `YTDLP_RATE_LIMITED`, `YTDLP_NETWORK_FAILED`, `YTDLP_EXTRACTOR_FAILED`, `YTDLP_TIMEOUT` o `YTDLP_FAILED`) y nunca se persiste ni se registra. Solo rate-limit, red, timeout y fallo desconocido se consideran transitorios; autenticación, contenido ausente/no soportado y extractor roto requieren acción explícita.

Los proveedores internos se diagnostican por separado. Whisper conserva un timeout de 120 segundos; Ollama permite 300 segundos para cubrir el cold start y la inferencia CPU de Qwen 2.5 3B sin provocar redeliveries prematuros. Timeout, HTTP 429 y HTTP 5xx son transitorios; respuestas 4xx se consideran rechazadas y no se reintentan automáticamente.
