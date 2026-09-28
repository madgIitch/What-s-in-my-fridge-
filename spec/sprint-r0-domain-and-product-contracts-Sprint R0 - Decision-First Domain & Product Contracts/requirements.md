# sprint-r0-domain-and-product-contracts · Sprint R0 - Decision-First Domain & Product Contracts — Requisitos

- name: `Sprint R0 - Decision-First Domain & Product Contracts` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-28T03:32:14.601Z

## Contexto

Fijar la nueva semántica de producto y extender el dominio de forma aditiva para representar lo que Neverita sabe, estima o desconoce sin rehacer la infraestructura ya terminada.

## Requisitos funcionales

R1. Todas las migraciones son aditivas y una versión anterior de la PWA puede seguir leyendo las columnas legacy necesarias.
R2. Un pantry item puede representar: solo presencia; estado cualitativo; cantidad exacta; o combinación válida sin campos contradictorios.
R3. quantity_precision=unknown impide afirmar suficiencia cuantitativa en el dominio.
R4. freshness_precision=estimated exige freshness_source y nunca rellena expiry_date_exact.
R5. expiry_date_exact solo acepta una fecha civil y provenance explícita package/user/retailer fiable.
R6. Las filas legacy se proyectan sin inventar stock_state ni freshness exacta; lo desconocido queda unknown.
R7. RecipeAvailability diferencia have_enough, have_presence_unknown_amount, missing y unknown.
R8. La navegación móvil muestra exactamente Hoy, Despensa, +, Cocinar y Compra; no muestra Calendar/Favorites como tabs.
R9. Los redirects legacy conservan deep links y query params allowlisted.
R10. PRODUCT_V3=false conserva el flujo v2; PRODUCT_V3=true activa shell/contratos v3 sin migración destructiva.
R11. Tests unitarios cubren todas las combinaciones de precisión, conversiones legacy y estados de receta.
R12. RLS sigue aislando todas las nuevas relaciones por usuario o por catálogo público según corresponda.

## Restricciones

- **error_states:** Entrada ambigua o contradictoria se rechaza o se proyecta como unknown; no se inventa suficiencia ni caducidad. Los datos antiguos siguen disponibles.
- **auth_secrets:** RLS aísla datos privados por propietario; catálogo público solo admite lectura de cliente. La flag PRODUCT_V3 se evalúa en servidor y no transporta secretos.
- **rollback_compat:** Desactivar PRODUCT_V3 restaura navegación v2. Migraciones aditivas mantienen datos y columnas legacy sin down migration destructiva.

