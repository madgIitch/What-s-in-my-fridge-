# QA de preparación R3 · 8 de octubre de 2026

Revisión manual de las ocho dimensiones y los 33 criterios contra código actual, contrato R2, pipeline de importación y reviews de calidad/Whisper. Sin ejecución delegada: el CLI instalado no dispone de prepare.

- Identidad de import privado separada del catálogo; snapshot de favorito estable.
- Conteo 2/4 y presencia/suficiencia definidos; cantidades desconocidas sin fallback.
- Endpoints, payloads, errores, paginación, TTL, conflictos y replay especificados.
- Scope ampliado respecto al borrador para API cook/retry/favorites, tipos y puente de snapshots; no motor Hoy ni features R4–R8.
- Flags, compatibilidad, seguridad y tests observables definidos.
- Benchmark humano y smoke de proveedores siguen sin evidencia; son gates de activación, no se consideran aprobados por este spec.

Resultado: listo para aprobación del usuario, spec_approved=false. Preparación documental; no implementación ni tests nuevos ejecutados.
