# Sesión actual

**sprint-r0-domain-and-product-contracts** cerrado en `done` por aceptación explícita del usuario el 28 de septiembre de 2026, tras la revisión en localhost. Ver `progress/review_sprint-r0-domain-and-product-contracts.md`. Servidor localhost con `PRODUCT_V3=true` y Supabase local para comparación visual; producción sin cambios.

**improve-recipe-import-quality** se cerró administrativamente por petición del usuario. La fidelidad y el rollout general siguen sin validar; los criterios pendientes están en `progress/review_improve-recipe-import-quality.md`. Las flags web de revisión/reproceso siguen apagadas.

## Spec actual

**sprint-r1-purchase-intake-and-pantry-normalization** preparado en `spec_ready`, con `spec_approved: false`. Propuesta, requisitos, diseño y tareas en su carpeta de `spec/`. Incluye 28 criterios de aceptación y ocho dimensiones revisadas. No se ha iniciado implementación.

Se copiaron al repo los exports encontrados en Descargas por petición del usuario: snapshot parcial de Eroski (23.172 productos), sus dos exports vacíos y los dos exports de Aldi (2.123 productos cada uno). Checksums y provenance en `docs/catalogs/local-sources.manifest.json`; uso y limitaciones en `docs/catalogs/R1_LOCAL_SOURCES.md`. Aldi se conserva pero su ingesta no amplía el alcance R1.

## Siguiente acción

Aprobación humana del spec R1 antes de implementar. Comparar la implementación en localhost con referencias 01/06/08. Las recomendaciones de Hoy pertenecen a R2.
