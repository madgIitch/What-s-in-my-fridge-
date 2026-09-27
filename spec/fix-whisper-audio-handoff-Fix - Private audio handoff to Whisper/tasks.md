# fix-whisper-audio-handoff · Tareas (aprobado)

- [x] Aprobar el spec y su scope en `spec.json` mediante el harness.
- [x] Definir y probar el contrato multipart autenticado de Whisper, límites y limpieza.
- [x] Adaptar ffmpeg y `TranscriptionProvider` para enviar audio real a `/transcribe`.
- [x] Diferenciar errores permanentes, transitorios y de configuración sin registrar datos sensibles.
- [x] Añadir pruebas de contrato, seguridad, regresión social y upload.
- [x] Configurar el secreto compartido en ambos servicios y desplegar Whisper antes que el worker.
- [x] Ejecutar smoke aislado de ambos caminos; el job previo no se reencola automáticamente según el runbook.
- [x] Actualizar docs y ejecutar los gates del harness.
- [ ] Smoke humano en la PWA para cerrar `review_pending`.
