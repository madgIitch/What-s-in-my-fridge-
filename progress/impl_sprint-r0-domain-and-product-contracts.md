# Sprint R0 · implementación en curso

Spec aprobada el 28 de septiembre de 2026. No está en revisión ni cerrada.

## Iniciado

- ADR `docs/product/PRODUCT_REORIENTATION_V3.md`: tesis, ciclo, precisión explícita, navegación v3 y convivencia con v2.
- Contratos puros en `packages/domain/src/pantry/knowledge.ts`: stock de presencia/cualitativo/exacto, frescura desconocida/estimada/exacta, proyección legacy conservadora y disponibilidad por ingrediente/receta.
- Cuatro pruebas de dominio pasan con `tests/vitest-r0.config.mjs` y un `tsconfig` propio del paquete.
- Typecheck y lint de web, 132 tests web, typecheck del paquete domain y cuatro tests de conocimiento de despensa pasan. Los gates restantes se ejecutarán al finalizar R0.

## Pendiente

- SQL aditivo para conceptos, productos comerciales y precisión/procedencia, con RLS y tests de dos usuarios.
- Ranking v2, tokens visuales, shell v3 bajo flag y rutas legacy con parámetros permitidos.
- Tipos de DB, pruebas de integración/E2E y gates completos.

R1 no tiene spec aprobado; no se implementa en esta fase.
