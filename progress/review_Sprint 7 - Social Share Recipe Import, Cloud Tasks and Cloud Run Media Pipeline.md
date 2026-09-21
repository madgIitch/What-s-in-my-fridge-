# Revisión · Sprint 7 - Social Share Recipe Import, Cloud Tasks and Cloud Run Media Pipeline

Estado: `review_pending`.

## Evidencia automática

- CI GitHub Actions `35606578423`: `web`, `database` y `deploy-staging` en verde.
- PostgreSQL se reconstruye exclusivamente desde migraciones; schema lint y pgTAP/RLS pasan.
- La restricción de resultado rechaza JSON incompleto incluso cuando faltan claves (sin semántica `NULL` permisiva de `CHECK`).
- Los tipos Supabase versionados coinciden exactamente con el esquema generado.
- Worker compilado y 13 tests aprobados localmente.

## Pendiente de aprobación humana

- Probar en móvil el fallback de pegar URL y, donde esté soportado, Web Share Target.
- Confirmar una ejecución real completa: creación durable, Cloud Tasks, Cloud Run, extracción/transcripción, Recipe JSON validado y recuperación del resultado en la PWA.
- Confirmar estados de error y reintento con proveedores reales sin exponer secretos o transcripciones en logs.

No se marca `done` hasta completar ese smoke conforme a `HARNESS.md`.
