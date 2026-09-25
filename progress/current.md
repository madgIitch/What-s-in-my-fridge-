# Sesión actual

Feature: **sprint-12-firebase-data-migration-and-reconciliation** — spec aprobado; implementación en curso.

El usuario aprobó la propuesta en `docs/migration/SPRINT12_PROPOSAL.md`. Hay captura Firestore por lotes con checkpoint, snapshot JSONL y manifiesto SHA-256, `plan`, `dry-run` con mapping Auth explícito e import idempotente de cuatro colecciones de dominio con guardia de destino y checkpoint. `cookingPreferences` se lee del documento raíz del usuario. El origen es `what-s-in-my-fridge-a2a07`; no hay export de datos exclusivos de WatermelonDB, así que la cobertura global se declara parcial. No se ha ejecutado lectura real ni import: faltan credenciales Firebase en esta sesión y las fases restantes del runner.

## Verificación

- Dependencias Sprint 9, 10 y 11 cerradas.
- Mappings previos de Auth y dominio revisados; Stripe se mantiene como autoridad económica.
- Seis pruebas sintéticas de captura, checksum, reanudación, transformación, cuarentena y guardia de destino aprobadas.

## Siguiente acción

- Completar mappings de preferencias, jobs, usage y suscripción histórica; Storage referenciado y reconciliación; después ejecutar captura y ensayo staging con credenciales de lectura.
