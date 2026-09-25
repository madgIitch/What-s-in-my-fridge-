# Sesión actual

Feature: **sprint-12-firebase-data-migration-and-reconciliation** — spec aprobado; implementación en curso.

El usuario aprobó la propuesta en `docs/migration/SPRINT12_PROPOSAL.md`. Hay captura Firestore por lotes con checkpoint, snapshot JSONL y manifiesto SHA-256, `plan`, `dry-run` con mapping Auth explícito, import idempotente de cuatro colecciones de dominio y cuatro proyecciones históricas, y reconciliación por claves y digest. `cookingPreferences` se lee del documento raíz del usuario. El origen es `what-s-in-my-fridge-a2a07`; no hay export de datos exclusivos de WatermelonDB, así que la cobertura global se declara parcial. No se ha ejecutado lectura real ni import: faltan credenciales Firebase en esta sesión y el inventario Storage.

## Verificación

- Dependencias Sprint 9, 10 y 11 cerradas.
- Mappings previos de Auth y dominio revisados; Stripe se mantiene como autoridad económica.
- Ocho pruebas sintéticas de captura, checksum, detección de drift, reanudación, transformación, cuarentena, guardia de destino y reconciliación aprobadas.

## Siguiente acción

- Inventariar Storage referenciado/huérfano, verificar mapping Auth contra staging y ejecutar captura e import/reconciliación reales con credenciales de lectura.
