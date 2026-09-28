# Sprint R0 · implementación para revisión

Spec aprobada el 28 de septiembre de 2026. Entrega local implementada; ver `progress/review_sprint-r0-domain-and-product-contracts.md`.

## Iniciado

- ADR `docs/product/PRODUCT_REORIENTATION_V3.md`: tesis, ciclo, precisión explícita, navegación v3 y convivencia con v2.
- Contratos puros en `packages/domain/src/pantry/knowledge.ts`: stock de presencia/cualitativo/exacto, frescura desconocida/estimada/exacta, proyección legacy conservadora y disponibilidad por ingrediente/receta.
- 20 pruebas de dominio pasan con `tests/vitest-r0.config.mjs` y un `tsconfig` propio del paquete.
- Typecheck, lint, 135 tests web y build de producción pasan.

## Entrega adicional

- SQL aditivo aplicado a Supabase local; db lint, 190 pruebas SQL existentes y 21 nuevas de precisión/RLS pasan.
- Ranking v2, tokens visuales, shell v3 bajo flag y rutas legacy con parámetros permitidos.
- Tipos de DB contrastados con generación local; smoke Playwright para flag encendida y apagada.
- Navegador localhost comparado con referencias 08 y 10; iconos SVG, botón central circular y título ajustados. Captura en `docs/design/neverita-v3/qa/r0-pantry-localhost.png`.

R1 no tiene spec aprobado; no se implementa en esta fase.
