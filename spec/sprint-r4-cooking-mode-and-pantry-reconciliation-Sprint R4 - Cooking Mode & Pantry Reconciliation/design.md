# sprint-r4-cooking-mode-and-pantry-reconciliation · Sprint R4 - Cooking Mode & Pantry Reconciliation — Diseño

## Scope (archivos que puede tocar)

- `apps/web/src/app/(auth)/app/cook/**`
- `apps/web/src/app/(auth)/app/recipes/**`
- `apps/web/src/app/api/cooking/v3/**`
- `apps/web/src/components/cooking/**`
- `apps/web/src/lib/cooking/**`
- `apps/web/src/types/database.generated.ts`
- `packages/domain/src/cooking/**`
- `packages/domain/src/pantry/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/**`
- `docs/**`
- `spec.json`

## Enfoque

- **data_model:** CookingSourceRef catalog/import/favorite; plan privado versionado TTL60min; recetas actuales o snapshot favorito inmutable. Lineas exact/qualitative/unresolved y asignación conservadora de lotes. Eventos before/after y compensación única append-only. Draft/outbox cooking independiente, aislado por usuario, sin afectar outbox inventory.
- **external_contracts:** GET /api/cooking/v3/plan y POST confirm/undo, payload y response definidos en criterios4,13,14,19,26. Replay canónico precede validación de estado vigente; mutation UUID único por usuario y operación/payload. API legacy /api/cooking intacta. planKey ligado a usuario, fuente/revisión y versiones.
- **edge_cases:** Agrupar conceptos/unidades compatibles; FEFO solo fecha exacta, null al final y desempate estable. Sin sustracción exacta cuando receta/stock unknown o incompatible. Descuento insuficiente bloquea propuesta exacta. Qualitative degrade precision y mantiene provenance. Lotes múltiples no exactos requieren selección explícita; ausencia/ambigüedad no crea pantry. Ajuste manual tiene evidencia user, no extracción.
- **ui_states:** /app/cook/session?kind&id y /app/cook/session/confirm; entrypoints catálogo/import/favorito. Pasos/progreso, Ya está, preview, Ajustar cantidades y confirmación/undo. Review_required explícito. Borrador por usuario/revisión, recuperación recarga y estados de conflicto/offline claros. Referencia09,320/393,44px,focus,reduced-motion.

## Decisiones de la entrevista

- **data_model:** CookingSourceRef catalog/import/favorite; plan privado versionado TTL60min; recetas actuales o snapshot favorito inmutable. Lineas exact/qualitative/unresolved y asignación conservadora de lotes. Eventos before/after y compensación única append-only. Draft/outbox cooking independiente, aislado por usuario, sin afectar outbox inventory.
- **error_states:** Contratos cooking-error-v1 y códigos status definidos en acceptance. No partial writes. Conflicto o expiración requiere replan+consentimiento y nuevo ID; fallo de red conserva ID. Offline pendiente no es éxito. Undo cinco minutos, versiones posteriores estrictas y conexión obligatoria.
- **edge_cases:** Agrupar conceptos/unidades compatibles; FEFO solo fecha exacta, null al final y desempate estable. Sin sustracción exacta cuando receta/stock unknown o incompatible. Descuento insuficiente bloquea propuesta exacta. Qualitative degrade precision y mantiene provenance. Lotes múltiples no exactos requieren selección explícita; ausencia/ambigüedad no crea pantry. Ajuste manual tiene evidencia user, no extracción.
- **auth_secrets:** Auth.uid y RLS planes/eventos/lotes; 404 uniforme. Request no usuario/receta/after arbitrarios; Origin y JSON estricto. Cache HTTP privada no-store. Logout cancela y purga drafts/outbox cooking saliente. No contenido privado ni secretos en logs.
- **external_contracts:** GET /api/cooking/v3/plan y POST confirm/undo, payload y response definidos en criterios4,13,14,19,26. Replay canónico precede validación de estado vigente; mutation UUID único por usuario y operación/payload. API legacy /api/cooking intacta. planKey ligado a usuario, fuente/revisión y versiones.
- **ui_states:** /app/cook/session?kind&id y /app/cook/session/confirm; entrypoints catálogo/import/favorito. Pasos/progreso, Ya está, preview, Ajustar cantidades y confirmación/undo. Review_required explícito. Borrador por usuario/revisión, recuperación recarga y estados de conflicto/offline claros. Referencia09,320/393,44px,focus,reduced-motion.
- **rollback_compat:** Flag false conserva legacy y no llama RPC v3. No R5/R6/Pro ni proveedores/calendario/cuotas. Migraciones locales aditivas sin reset; compat stock legacy nunca evidencia exacta. No activar rollout ni SQL remoto; calidad humana/Whisper/GCS pendiente de R3 continúa documentada.
- **tests:** Harness/domain/build/DB lint/pgTAP y Playwright local incluyendo concurrencia, replay, undo, dos usuarios y offline real. SQL rollback; fixture browser solo localhost. Comparación visual09 a320/393, mocks identificados. Lockfile estable no exige instalación; si cambia frozen obligatorio.
