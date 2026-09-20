# Review · sprint-5-receipt-ocr-and-draft-review · Sprint 5 - Receipt OCR and Draft Review

## Veredicto

REVIEW PENDING. La implementación web compila y sus comprobaciones deterministas pasan; el cierre requiere validar la migración/RLS contra Supabase local y ejecutar el smoke humano.

## Checkpoints

- [x] `pnpm install --frozen-lockfile`
- [x] límites de imports, entorno y clientes Supabase
- [x] typecheck
- [x] lint sin warnings
- [x] Vitest: 24 tests
- [x] build de producción
- [ ] `supabase db lint` — Docker Desktop no está activo
- [ ] pgTAP/RLS — Docker Desktop no está activo
- [ ] Playwright completo y filas canónicas
- [ ] smoke humano

## Correcciones de revisión

- Los reintentos conservan `draftId`, `requestId` y los bytes recomprimidos.
- Vision no realiza un segundo intento facturable dentro del adaptador.
- La liberación previa a Vision puede borrar correctamente el draft reservado.
- La confirmación bloquea dobles envíos en cliente y sigue siendo idempotente en servidor.
