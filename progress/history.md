# Historial de sesiones

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
