# fix-whisper-audio-handoff · Requisitos (aprobado)

`spec_approved: true` en `spec.json`.

## Problema comprobado

El 27 de septiembre de 2026 el job `10e86cf6-acac-4690-8e32-c9f1f7ece96e` terminó con `WHISPER_REJECTED`. Cloud Run registró `POST /` al servicio Whisper con HTTP 404. El worker envía además `audioPath`, una ruta local que Whisper no puede abrir. Una prueba de la alternativa `POST /transcribe` con la URL social obtuvo HTTP 400 porque ese servicio intentó descargar de nuevo el contenido. La entrega debe usar el audio que ya descargó y convirtió el worker.

## Requisitos funcionales

R1. Si el texto disponible es suficiente, el job sigue sin invocar Whisper.

R2. Si hace falta audio, el worker descarga el medio social o el archivo compartido, aplica ffmpeg y envía los bytes resultantes a `/transcribe`. No se transmite `audioPath` ni se repite la descarga social desde Whisper.

R3. El contrato de `/transcribe` acepta una parte multipart `audio` en MP3 mono de hasta 20 MiB; responde con `text` e `language` compatibles con el adapter. El contrato legado por URL puede mantenerse durante la transición.

R4. La entrada binaria solo acepta al worker autorizado. El secreto compartido se obtiene de Secret Manager en runtime y se compara de forma segura. No aparece en código, imagen, logs, jobs ni navegador.

R5. Se limita la duración del audio a 10 minutos antes de transcribir, además del tamaño de entrada. La petición a Whisper tiene un timeout de 300 segundos. Whisper elimina el temporal en éxito, error y timeout. El worker mantiene su limpieza actual.

R6. El proveedor traduce 400/413 de audio inválido o excesivo, 401/403 de autenticación, 429/5xx y timeout a códigos seguros diferenciados. Solo los fallos transitorios se reintentan automáticamente. La UI puede ofrecer reintento manual para fallos permanentes sin duplicar cuota.

R7. Una transcripción vacía o insuficiente no produce receta `completed`; una receta validada conserva la idempotencia y procedencia existentes.

R8. Un smoke en staging o entorno aislado cubre un vídeo social con metadatos insuficientes y un archivo subido. El despliegue de ambos servicios conserva compatibilidad mientras conviven revisiones antiguas y nuevas.

R9. La documentación operativa explica despliegue, rollback y qué hacer con jobs `WHISPER_REJECTED` ya fallidos. No se reencolan automáticamente imports antiguos ni se consume otra cuota sin acción explícita.

R10. Pasan pruebas del worker, contrato de Whisper, gates del repo y comprobación de que no se filtran bytes, transcripciones, enlaces privados o secretos en logs.
