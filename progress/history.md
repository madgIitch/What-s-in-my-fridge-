# Historial de sesiones

## 2026-09-28 — Sprint R0 → review_pending
- Dominio de conocimiento, catálogos separados, migraciones aditivas y shell PRODUCT_V3 implementados. Typecheck, lint, 135 tests web, 20 tests de dominio, build, db lint y 211 pruebas SQL pasan.
- Smoke Playwright local con flag activada/desactivada; revisión visual continua de localhost contra referencias 08 y 10, evidencia en docs/design/neverita-v3/qa. Producción sin cambios.

## 2026-09-28 — improve-recipe-import-quality → done administrativo; R0 iniciado
- Cierre administrativo solicitado por el usuario. Los gates de la PWA pasaron al repetir la suite completa (132 tests); el benchmark humano, canary y validación de fidelidad siguen pendientes y constan en `progress/review_improve-recipe-import-quality.md`.
- `sprint-r0-domain-and-product-contracts` recibió aprobación de spec y comenzó con ADR y contratos puros de conocimiento de despensa. R1 sigue pendiente de aprobación.

## 2026-09-25 — sprint-12-firebase-data-migration-and-reconciliation → done administrativo
- Cierre del spec solicitado por el usuario. Nueve pruebas sintéticas aprobadas; ensayo real de Firebase y Supabase staging pendiente por credenciales, bucket y mapping Auth. El review conserva los criterios sin verificar; no implica cutover ni migración completada.

## 2026-09-22 — sprint-10-stripe-pro-and-usage → review_pending
- Stripe Pro, entitlement y uso canónico implementados; gates y pruebas adicionales aprobados.

## 2026-09-20 — sprint-5-receipt-ocr-and-draft-review → review_pending
- Flujo OCR/revisión implementado; gates web en verde. SQL/RLS y smoke quedan pendientes por Docker Desktop inactivo.

- 2026-09-18 · `sprint-0-pwa-migration-foundation`: spec aprobado, shell Next.js/PWA, CI, límites de entorno, paquete domain y arquitectura de migración implementados. Typecheck, lint, unit test, Playwright E2E, boundary/env checks y build pasaron. Estado: `review_pending`.
# Sprint 6 · Recipe Catalog, Normalization and Suggestions → review_pending

- Implementación: commit `1a66688`.
- Gates aprobados: boundaries, env, Supabase boundaries, typecheck, lint, 33 tests, build, dry-run y tests del importador.
- Pendiente por infraestructura: pgTAP/RLS y smoke E2E autenticado (Docker Desktop no está activo).

# Sprint 7 · Social Share Recipe Import, Cloud Tasks and Cloud Run Media Pipeline → review_pending

- Implementación principal: `db56be1`; endurecimiento SQL y sincronización de tipos: `3930120`, `34e3a17`.
- CI `35606578423` aprobó web, reconstrucción completa de base, lint SQL, pgTAP/RLS, tipos generados y despliegue de migraciones a staging.
- Worker media/IA: build y 13 tests aprobados localmente; incluye idempotencia, captions-first, fallback Whisper, validación estructurada, SSRF y cleanup.
- Pendiente para `done`: smoke humano móvil autenticado y verificación end-to-end con Cloud Tasks, Cloud Run y proveedores reales.
# 2026-09-28 · Sprint R0 → done

- Cierre por aceptación explícita del usuario tras la revisión visual en localhost.
- Implementación `ba1fe34`; cierre del harness `7ef592f`. Producción sin cambios.
# 2026-09-28 · Sprint R1 → spec_ready

- Preparación manual de las ocho dimensiones; el CLI actual del harness no incluye `prepare`. Sin aprobación ni implementación.
- 28 criterios: review de ticket, normalización conservadora, edición de Despensa, compatibilidad, offline y comparación visual en localhost.
- Datasets encontrados en Descargas conservados en `docs/catalogs/data/` con Git LFS y manifest SHA-256. Eroski parcial con 23.172 productos; Aldi con 2.123. Cuatro retailers sin exports localizados.

# 2026-10-01 · Sprint R1 → review_pending

- Aprobación e implementación completadas: purchase intake, review conservadora, correcciones, editor y offline aislado por usuario; compatibilidad v2.
- Gates, build, 220 pruebas SQL, 24 domain, 11 catálogo y recorridos E2E con DB local aprobados. Capturas 320/390px documentadas.
- Smoke humano con ticket real pendiente; producción sin cambios. Error de reset local inicial documentado en current.md.

# 2026-10-01 · Sprint R1 → done por solicitud del usuario

- Cierre explícito solicitado tras el push de la implementación `6ce5b59`.
- No se aportó evidencia nueva del smoke con ticket real/cámara/voz; continúa pendiente en el review. Producción sin cambios.

# 2026-10-01 · Sprint R2 → spec_ready

- Preparación solicitada por el usuario; ocho dimensiones cubiertas, 32 criterios y QA manual de contratos/casos límite.
- Hoy automático y sin cuota, cantidades/frescura conservadoras, compra explícita/idempotente y onboarding. Límites de catálogo, offline y rollback v2 definidos.
- Propuesta guardada, `spec_approved: false`; sin implementación ni despliegue.
