# sprint-r0-domain-and-product-contracts · Sprint R0 - Decision-First Domain & Product Contracts — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [x] (T1) Todas las migraciones son aditivas y una versión anterior de la PWA puede seguir leyendo las columnas legacy necesarias.  ↔ R1
- [x] (T2) Un pantry item puede representar: solo presencia; estado cualitativo; cantidad exacta; o combinación válida sin campos contradictorios.  ↔ R2
- [x] (T3) quantity_precision=unknown impide afirmar suficiencia cuantitativa en el dominio.  ↔ R3
- [x] (T4) freshness_precision=estimated exige freshness_source y nunca rellena expiry_date_exact.  ↔ R4
- [x] (T5) expiry_date_exact solo acepta una fecha civil y provenance explícita package/user/retailer fiable.  ↔ R5
- [x] (T6) Las filas legacy se proyectan sin inventar stock_state ni freshness exacta; lo desconocido queda unknown.  ↔ R6
- [x] (T7) RecipeAvailability diferencia have_enough, have_presence_unknown_amount, missing y unknown.  ↔ R7
- [x] (T8) La navegación móvil muestra exactamente Hoy, Despensa, +, Cocinar y Compra; no muestra Calendar/Favorites como tabs.  ↔ R8
- [x] (T9) Los redirects legacy conservan deep links y query params allowlisted.  ↔ R9
- [x] (T10) PRODUCT_V3=false conserva el flujo v2; PRODUCT_V3=true activa shell/contratos v3 sin migración destructiva.  ↔ R10
- [x] (T11) Tests unitarios cubren todas las combinaciones de precisión, conversiones legacy y estados de receta.  ↔ R11
- [x] (T12) RLS sigue aislando todas las nuevas relaciones por usuario o por catálogo público según corresponda.  ↔ R12
- [x] Tests que cubran los criterios de aceptación
