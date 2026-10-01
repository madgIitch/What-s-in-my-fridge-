# Revisión R1 — 2026-10-01

Estado: `review_pending`. Implementación y validación automática completadas sobre Supabase local. El cierre `done` requiere smoke humano según HARNESS.md.

## Evidencia

- Gates: typecheck, lint sin warnings, unit web y diff-scope.
- Build Next.js aprobado; tipos de Supabase regenerados desde instancia local.
- SQL/RLS: 10 archivos, 220 pruebas; lint DB sin errores de esquema.
- Domain: typecheck y 24 pruebas; importadores: 11 pruebas.
- Compatibilidad/outbox: seis pruebas, incluyendo separación de payload legacy, aislamiento de sesión y versiones sucesivas tras un intento previo.
- Playwright Chromium móvil: cinco recorridos R1 aprobados; repetición del recorrido offline con recarga real aprobada. Prueba adicional de 320px/controles de 44px/teclado/reduced motion aprobada. Prueba separada con flag false aprobada (scan legacy y redirect de pantry a Mi Nevera).
- Eroski real congelado: dry-run valida 23.172 productos, cero rechazados y SHA-256 del manifest. Cuatro retailers ausentes; fixtures de cinco adaptadores. Aldi no se ingesta.
- Capturas reales a 320/390px y comparación: `docs/design/neverita-v3/qa/R1_COMPARISON.md`.

## Cobertura y límites

Confirmación atómica/replay y correcciones versionadas se comprueban en SQL; UI de review incluye OCR Vision simulado. Los recorridos manual/barcode desconocido, pendientes, eliminación/deshacer, offline y conflicto usan DB local real. No se afirma validación de OCR contra Vision real ni de captura física de cámara/dictado: requieren el smoke humano.

Sin conexión, la recarga usa la pantalla PWA existente «Inventario local» para leer IndexedDB. El editor v3 permite encolar cambios si ya está abierto; una recarga completa del editor sin red no recrea todo el shell v3.

Los controles/teclado/movimiento reducido se verifican automáticamente en el hub de compra; la inspección de capturas y CSS cubre el resto de superficies. La revisión humana móvil completa sigue pendiente.

No hay despliegue, activación de producción ni integración real de los cuatro catálogos ausentes. Incidencia de reset local documentada en `progress/current.md`; las cinco migraciones R1 conservadas son aditivas.

## Pendiente humano

- [ ] Smoke móvil con ticket real y, cuando estén disponibles, cámara y voz.
- [ ] Aceptación del diff y comparación visual antes de `done`.
