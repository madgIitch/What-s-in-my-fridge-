# sprint-13-ui-parity-responsive-and-accessibility · undefined — Diseño

## Scope (archivos que puede tocar)

- `apps/web/**`
- `packages/ui/**`
- `tests/e2e/**`
- `docs/design/**`
- `spec.json`

## Enfoque

- **data_model:** Sin cambios de dominio. Las rutas de detalle usan IDs existentes y estados de no encontrado; los fixtures sintéticos sustituyen el staging de datos aún pendiente.
- **external_contracts:** Matriz de paridad para las 20 pantallas y rutas PWA; flujo crítico auth → inventory → scan mock → review → recipes → favorite → calendar → paywall.
- **edge_cases:** Pantallas legacy sin URL obtienen ruta o sustituto documentado; 320 px, zoom 200 %, texto largo, orientación y prefers-reduced-motion se verifican.
- **ui_states:** Navegación única con aria-current; destinos consistentes en móvil y desktop; targets 44×44, foco visible y diálogos con Escape y retorno de foco.

## Decisiones de la entrevista

- **visual_identity:** Propuesta provisional: conservar Neverita, la identidad ya usada por la PWA. Pendiente de confirmación del usuario.

