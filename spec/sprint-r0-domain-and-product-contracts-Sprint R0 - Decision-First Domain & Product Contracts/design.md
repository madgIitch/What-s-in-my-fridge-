# sprint-r0-domain-and-product-contracts · Sprint R0 - Decision-First Domain & Product Contracts — Diseño

## Scope (archivos que puede tocar)

- `supabase/migrations/**`
- `packages/domain/**`
- `packages/ui/**`
- `apps/web/src/app/(auth)/app/**`
- `apps/web/src/components/navigation/**`
- `apps/web/src/styles/**`
- `apps/web/src/types/database.generated.ts`
- `tests/**`
- `docs/design/**`
- `docs/product/**`
- `spec.json`

## Enfoque

- **data_model:** Separar food_concept, commercial_product, item de despensa y conocimiento de cantidad/frescura con precisión y procedencia explícitas. Los campos legacy siguen legibles.
- **external_contracts:** R0 no introduce proveedor externo. Conserva contratos de inventario, receta, auth y rutas legacy; cambios SQL y TypeScript son aditivos.
- **edge_cases:** Presencia sin cantidad, estado cualitativo, fecha civil, procedencia ausente, ingrediente sin correspondencia y deep links legacy están cubiertos por acceptance.
- **ui_states:** Shell móvil Hoy/Despensa/+/Cocinar/Compra bajo flag y flujo v2 cuando está apagada. No se exponen porcentajes de ranking como copy principal.

