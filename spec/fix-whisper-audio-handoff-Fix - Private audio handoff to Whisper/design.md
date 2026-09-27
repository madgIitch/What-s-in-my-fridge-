# fix-whisper-audio-handoff · Diseño (aprobado)

## Alcance

- `services/media-worker/**`
- `whats-in-my-fridge-backend/whisper_api.py`
- `whats-in-my-fridge-backend/Dockerfile.whisper`
- `whats-in-my-fridge-backend/cloudbuild.whisper.yaml`
- `whats-in-my-fridge-backend/tests/**`
- `infrastructure/gcp/cloud-run/**`
- `docs/**`, `spec/**`, `progress/**`, `spec.json`

## Contrato entre servicios

El worker conserva el orden actual: metadatos/captions → evaluación de suficiencia → yt-dlp o upload → ffmpeg. ffmpeg genera MP3 mono a 16 kHz y 48 kbps; rechaza audio de más de 10 minutos antes de llamar a Whisper. `TranscriptionProvider` envía ese archivo como `multipart/form-data` a `${WHISPER_SERVICE_URL}/transcribe` con `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` y timeout de 300 segundos. El endpoint admite la nueva parte `audio`; la rama antigua `{url}` sigue disponible durante la migración y se retira solo en otro cambio aprobado. La respuesta exitosa contiene `text` e `language`.

Whisper escribe la parte `audio` en un temporal privado con un máximo de 20 MiB antes de invocar el modelo. Rechaza formatos ajenos a MP3 y elimina el temporal en `finally`. El token interno se configura en ambos Cloud Run mediante la misma versión de Secret Manager, con comparación de tiempo constante; las peticiones binarias sin token válido devuelven 401. No se guardan medios ni transcripciones en GCS para URLs sociales, conforme al Sprint 7.

## Errores e idempotencia

`WHISPER_AUDIO_INVALID` y `WHISPER_AUDIO_TOO_LARGE` son permanentes. `WHISPER_AUTH_FAILED` señala configuración rota y exige alerta operativa; no se reintenta indefinidamente. `WHISPER_TIMEOUT`, `WHISPER_UNAVAILABLE` y `WHISPER_RATE_LIMITED` admiten retry acotado. Texto vacío pasa al control `TEXT_INSUFFICIENT`. Los errores almacenan solo código; los detalles HTTP y el contenido nunca llegan a Supabase ni a la UI. Los RPC de lease y complete existentes siguen siendo la autoridad para evitar completados duplicados.

## Despliegue y verificación

1. Preparar secreto y revisión nueva de Whisper con contrato binario compatible con el antiguo.
2. Probar Whisper con audio sintético, petición sin token y petición sobredimensionada.
3. Desplegar el worker con URL y secreto correctos; verificar una importación social de prueba y un upload de prueba hasta `completed` o error funcional preciso.
4. Si falla, volver a la revisión anterior del worker y pausar imports que requieran Whisper; mantener la revisión compatible de Whisper. No marcar antiguos jobs fallidos como `completed` ni reencolarlos automáticamente.

No se modifica el esquema de Supabase ni el flujo de cuotas. La documentación del pipeline se actualiza cuando la implementación esté verificada.
