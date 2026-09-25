# Sesión actual

Feature: **sprint-12-firebase-data-migration-and-reconciliation** — cierre administrativo solicitado; veredicto en `progress/review_Sprint 12 - Firebase Data Migration and Reconciliation.md`.

El usuario aprobó la propuesta en `docs/migration/SPRINT12_PROPOSAL.md`. Hay captura Firestore por lotes con checkpoint, snapshot JSONL y manifiesto SHA-256, `plan`, `dry-run` con mapping Auth explícito, import idempotente de cuatro colecciones de dominio y cuatro proyecciones históricas, reconciliación por claves y digest, e inventario read-only de Storage referenciado/huérfano. `cookingPreferences` se lee del documento raíz del usuario. El origen es `what-s-in-my-fridge-a2a07`; no hay export de datos exclusivos de WatermelonDB, así que la cobertura global se declara parcial. No se ha ejecutado lectura real ni import: faltan credenciales Firebase en esta sesión y no se conoce aún el bucket real.

## Verificación

- Dependencias Sprint 9, 10 y 11 cerradas.
- Mappings previos de Auth y dominio revisados; Stripe se mantiene como autoridad económica.
- Nueve pruebas sintéticas de captura, checksum, detección de drift, reanudación, transformación, cuarentena, guardia de destino, reconciliación e inventario Storage aprobadas.

## Siguiente acción

- Retomar los pendientes de staging registrados en el review antes de declarar la migración de datos completada o autorizar un cutover.
