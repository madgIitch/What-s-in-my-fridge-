# R5 · revisión

13 de octubre de 2026. Pendiente smoke humano antes del cierre mediante
spec.mjs done, conforme a HARNESS.md.

Revisión de contratos estrictos, Origin, sesión/RLS, procedencia múltiple,
sugerencias que nunca son stock, fusión solo por concepto y unidad compatible,
replay, versiones, reconciliación conservadora y compensación única. Compra
nunca escribe despensa. La migración existe solo en local.

Evidencia: docs/design/neverita-v3/qa/R5_COMPARISON.md. pgTAP 392 aserciones
(60 propias), DB lint, web 188, dominio 9, typecheck, lint sin warnings y build
PASS. Playwright v3: cinco recorridos; rollback con PRODUCT_V3=false pasa.

## Decisiones y desviaciones del spec aprobado

- /app/add-purchase/ticket no existe: el ticket sigue en /app/scan con
  ?shoppingSession=<uuid>. purchase-review.tsx queda fuera de scope: la
  conciliación se ofrece desde Compra al detectar tickets confirmados.
- source/source_ref ya existían desde R3: se amplía la restricción, no se
  duplican columnas.
- La purga al cerrar sesión se engancha al evento neverita:stop-workers desde la
  navegación v3 porque lib/pwa/private-data.ts está fuera de scope.
- Fusión de no resueltos: nombre normalizado idéntico y misma unidad.

## Checkpoints humanos

- Usar la lista en móvil real, con y sin conexión; probar ticket real con
  /app/scan y la revisión posterior.
- Comprobar que cerrar sesión borra la lista local en Safari/Firefox.
- Mantener pendientes los gates humanos de calidad y Whisper/GCS de R3.
