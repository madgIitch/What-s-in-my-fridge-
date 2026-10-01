# Implementación R1 — 2026-10-01

Spec aprobado por el usuario; implementación en la rama actual conforme a docs/CONVENTIONS.md. El harness se inició y se continuó manualmente tras interrupciones y revisión de contratos.

- Compra/revisión y editor de Despensa implementados, sin ampliar R2.
- Normalizador puro y API privadas con validación de evidencia; RPC atómicas, replay, mappings privados, pendientes sobre el mismo item y permisos restringidos.
- Importador transaccional con hash/esquema y adaptadores de cinco retailers; Eroski real validado, otros ausentes.
- Outbox con dominio explícito, payload intentado inmutable, avance causal de expectedVersion y sesión comprobada antes/después de I/O.
- Migraciones correctivas locales aditivas, tipos regenerados y pruebas SQL/unit/E2E aprobadas. Ver review para evidencia y límites.
- El error inicial de reset local queda registrado en current.md; no se volvió a ejecutar.
