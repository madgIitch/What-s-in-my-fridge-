# R3 · review_pending

8 de octubre de 2026. Implementación y gates automáticos aprobados; pendiente
smoke humano antes del cierre por spec.mjs done, conforme a HARNESS.md.

Revisión: ownership y 404 uniforme, privilegios/RLS, snapshot vigente, replay
antes de validar estado nuevo, cantidades desconocidas, origen de compra,
unicidad de favoritos, revisiones aceptadas sin reescribir snapshots, retry sin
nueva cuota y rollback v2 cubiertos por pruebas. No hay cambios R4–R8.

Evidencia: progress/impl_sprint-r3-cook-library-and-import-bridge.md y
docs/design/neverita-v3/qa/R3_COMPARISON.md. Gates harness, build, dominio,
DB lint, 290 aserciones SQL, concurrencia y Playwright local PASS.

## Checkpoints humanos

- Recorrer Cocinar y una importación propia: disponibilidad, confirmación de
  compra, guardado y acceso al snapshot/calendario legacy.
- Revisar las capturas 320/393 contra las referencias 05/07.
- Mantener bloqueada la activación general hasta completar el corpus humano
  12 casos split 8/4, veinte ejecuciones warm y umbrales de calidad originales,
  WebKit/Firefox y smoke real URL/Whisper/GCS. Completed no acredita fidelidad.

La migración existe únicamente en local. No se ejecutó reset ni SQL remoto.
Los bloqueos transaccionales priorizan consistencia; falta medir contención en
tráfico real. Las pruebas de archivo y procesamiento externo usan mocks.
