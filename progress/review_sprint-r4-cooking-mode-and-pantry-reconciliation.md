# R4 · revisión

8 de octubre de 2026. Pendiente smoke humano antes del cierre mediante
spec.mjs done, conforme a HARNESS.md.

Revisión de contratos estrictos, Origin, sesión/RLS, fuente favorita inmutable,
unknown sin resta, versiones, replay, atomicidad y compensación de undo. No
hay cambios a consumo/cuota legacy ni R5–R8. La migración existe solo en local.

Evidencia: progress/impl_sprint-r4-cooking-mode-and-pantry-reconciliation.md y
docs/design/neverita-v3/qa/R4_COMPARISON.md. Concurrencia cubre replay de confirm,
gestos distintos, compensación única, undo frente a edición y lectura R3 frente
a consumo R4. DB lint y 332 aserciones SQL pasan. Playwright v3 y rollback pasan.

## Checkpoints humanos

- Cocinar receta propia, revisar cantidades/estados, confirmar y deshacer.
- Revisar capturas320/393 contra referencia09 y legibilidad en móvil real.
- Mantener pendientes los gates humanos de R3: corpus12 casos split8/4,
  veinte ejecuciones warm, umbrales de calidad, WebKit/Firefox y smoke real
  URL/Whisper/GCS antes de activación general.

R4 conserva bloqueos de tablas para consistencia del catálogo y del inventario
durante la transacción; falta medir contención con tráfico real. Fixtures E2E
persisten solo en local; SQL revierte y concurrencia limpia sus propios UUIDs.
