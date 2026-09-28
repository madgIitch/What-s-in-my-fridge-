# Tareas

- [x] Auditar entrada, job real, fuentes, audio, Whisper, Ollama, validación, RPC y UI.
- [x] Registrar evidencia y límites de atribución en docs/RECIPE_IMPORT_QUALITY_AUDIT.md.
- [x] Aprobar spec antes de cambios funcionales.
- [ ] Reproducir reel aisladamente y anotar referencia humana; crear corpus/split y baseline.
- [ ] Evaluar ASR/audio/idioma y recursos; documentar selección y versiones.
- [ ] Implementar subtítulos, cobertura y fusión de fuentes sin pérdida de caption.
- [ ] Ampliar contrato ASR compatible y conservar señales en memoria.
- [ ] Implementar extracción con schema, evidencia y reglas de cantidades/pasos.
- [ ] Implementar quality gate, revisión requerida y presupuesto global de retries.
- [ ] Migración aditiva/RLS de revisiones; edición propia y reproceso explícito idempotente sin cuota adicional.
- [ ] Mostrar fuente, avisos, cantidades desconocidas y revisión en UI móvil.
- [ ] Ejecutar benchmark ciego, gates/build, worker/Python, RLS y Playwright.
- [ ] Canary con flag apagado, activar solo al pasar criterios; smoke humano y rollback documentados.

## Avance verificado

- [x] Reproducción aislada real ASR + extracción (sin referencia humana todavía).
- [x] Fuentes separadas, VTT, schema de evidencia y medidas desconocidas omitidas.
- [x] Contrato ASR v2 compatible y deadline compartido.
- [x] Historial/RLS/CAS, edición y restauración probados en Supabase local.
- [x] Smoke Chrome móvil de revisión y restauración.
- [ ] Referencias humanas, comparación small/audio, benchmark completo, calibración semántica y canary.
