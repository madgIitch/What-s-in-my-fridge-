# Verificación · fix-whisper-audio-handoff

Spec aprobado por peorr; revisión humana pendiente después de activación.

Producción: 100% de tráfico en `whisper-service-00006-nem` y `neverita-media-worker-00007-zaw`. La revisión final de Whisper volvió a transcribir el audio de prueba después de añadir ffprobe.

## Evidencia

- `npm test` en `services/media-worker`: 20 tests y compilación TypeScript pasan.
- Python unittest: 8 tests pasan, incluyendo contrato legado, auth, formato corrupto, límites de request/audio y limpieza en éxito/fallo.
- Gates del harness: typecheck, lint, 129 tests web y diff-scope pasan.
- Whisper nuevo sin tráfico devuelve 401 al multipart sin token.
- El audio del reel que produjo el incidente se transcribe correctamente: 123 palabras; no se conserva ni registra el texto en esta memoria.
- Smoke aislado del pipeline social con yt-dlp, ffmpeg, Whisper y Ollama reales llega a `completed` con Recipe validado. El repositorio de jobs se sustituye por un stub para no escribir en datos del usuario.
- Smoke aislado del pipeline file con ffmpeg y proveedores reales llega a `completed` y ejecuta cleanup. La entrega GCS se sustituye por una respuesta controlada; no verifica una nueva subida desde el navegador ni los permisos GCS de producción.

## Operación

Secreto `whisper-internal-service-token`, versión 1, creado en Secret Manager con acceso solo para las identidades de runtime de los dos servicios. El worker permanece privado por Cloud Run y OIDC; el nuevo contrato multipart de Whisper requiere token. El contrato URL legado sigue disponible.

El job histórico fallido conserva su estado. Un reintento operativo debe encolar el mismo `jobId`, sin crear otra reserva de cuota, y requiere acción explícita. No se reencolan automáticamente trabajos antiguos.
