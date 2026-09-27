# Recuperación del resultado importado — Sprint 7

- [x] Las importaciones completadas ofrecen «Ver receta».
- [x] `/app/recipes/import/[jobId]` muestra título, ingredientes y pasos del resultado persistido.
- [x] La consulta requiere sesión y restringe `user_id`; IDs inválidos o resultados inexistentes devuelven 404.
- [x] Estados incompletos, errores de lectura y resultados inválidos tienen mensajes recuperables.
- [x] Conserva estética rosa y enlaces de regreso a importaciones y recetas.
- [x] Typecheck, lint y 129 tests existentes pasan.
- [x] Corrección del build: validación runtime dentro de `apps/web`, sin imports fuera del root de Turbopack.
- [x] `pnpm --dir apps/web build` pasa y genera `/app/recipes/import/[jobId]`.
- [x] Tests de validación cubren receta persistida, medidas opcionales y resultados inválidos.
- [ ] Smoke humano en producción: abrir la tortilla importada y leer ingredientes y preparación.

Estado: `review_pending`. Corrección del requisito HU7.3 de recuperar el resultado tras reabrir la PWA; no modifica el catálogo ni vuelve a consumir cuota.
