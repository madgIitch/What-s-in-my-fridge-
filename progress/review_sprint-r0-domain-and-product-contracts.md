# Revisión Sprint R0

Implementación aceptada y spec cerrado en `done` por petición explícita del usuario («cierra spec») el 28 de septiembre de 2026, tras la revisión en localhost. Activación limitada a localhost; no hay despliegue ni cambio de flag de producción.

## Entrega

- ADR de producto; conceptos culinarios y productos comerciales separados.
- Migraciones aditivas `20260928000300_product_v3_knowledge.sql` y `20260928000400_product_v3_normalization_contract.sql`; campos legacy intactos y nuevos campos de precisión desconocidos por defecto, con procedencia explícita para la normalización.
- Contratos puros de cantidad, frescura y disponibilidad, proyección legacy conservadora y ranking v2 determinista sin porcentaje público.
- Shell bajo flag server-only `PRODUCT_V3`, navegación Hoy/Despensa/+/Cocinar/Compra y tokens visuales compartidos.
- Colecciones legacy recetas/favoritos redirigen a Cocinar con `q` y `page` validados. Detalles de receta, import, inventario y calendario conservan sus URLs.
- Comparación visual en navegador de localhost contra referencias 08 y 10; captura y diferencias por sprint en `docs/design/neverita-v3/qa/`.

## Evidencia

- Typecheck, lint, 135 tests web; 20 tests de dominio R0.
- Build de producción pasa.
- Migración aplicada solo en Supabase local; tipos contrastados con generación local.
- `db lint` sin errores; 190 tests SQL existentes y 21 nuevos de R0 pasan.
- Playwright móvil: shell v3, menú +, redirects seguros y ancho de 320 px; flag apagada conserva entrada de inventario v2.

La suite histórica de Sprint 13 falló por esperar el copy anterior «guardaron una sola vez», mientras el resultado visible fue «Los artículos se guardaron correctamente». El smoke específico de rollback R0 pasa. No se modificó esa prueba fuera del scope aprobado.

## Revisión humana

Aceptación del usuario registrada tras la entrega y revisión en localhost. R1 y R2 implementarán las superficies de las referencias en sus specs propios. La migración y flag necesitan su despliegue autorizado cuando corresponda.
