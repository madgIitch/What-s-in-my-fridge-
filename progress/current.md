# Sesión actual

Corrección actual: Sprint 7, recuperación del resultado importado — `review_pending`. Cada importación completada enlaza a su pantalla de ingredientes y pasos. Ver `progress/review_imported-recipe-access.md`; pendiente smoke humano en producción.

Feature: **fix-whisper-audio-handoff** — `review_pending`; implementación verificada y activa en Cloud Run.

El worker entrega audio MP3 por multipart autenticado a `/transcribe`. Whisper valida audio/tamaño/duración y limpia temporales. La entrada por URL previa permanece compatible. La evidencia está en `progress/review_fix-whisper-audio-handoff.md`.

## Verificación

- 20 tests del worker y 8 tests Python pasan.
- Gates del harness pasan: typecheck, lint, 129 tests web y diff-scope.
- Smoke social y file aislados completan la receta validada; el smoke file verifica cleanup con GCS controlado.
- El Sprint 13 conserva su revisión visual humana pendiente y los límites de migración del Sprint 12 siguen registrados en su review.

## Siguiente acción

- Smoke humano del import en la PWA. Los jobs históricos fallidos no se reencolan sin acción explícita.
