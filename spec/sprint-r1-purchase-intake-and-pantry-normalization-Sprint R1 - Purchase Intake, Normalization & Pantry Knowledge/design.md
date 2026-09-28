# Sprint R1 — Diseño propuesto

Pendiente de aprobación.

## data_model

Extensiones aditivas a R0: raw_name/raw_text, retailer y origen draft/line, normalizer_version, ubicación nullable (fridge/pantry/freezer), mappings privados y manifests de catálogo. Una línea aceptada produce una fila; sin fusionar compras distintas. Cantidad, fecha de compra, frescura y normalización mantienen precisión/procedencia independientes. Defaults sintéticos del parser v1 no constituyen evidencia.

## error_states

OCR conserva códigos, cuotas y privacidad existentes. Catálogo ausente/corrupto no bloquea revisión; se usa unknown. Confirmación es atómica, replay idéntico devuelve mismos IDs; replay distinto devuelve 409. Sin conexión se permite lectura y edición local, pero OCR y confirmación de ticket necesitan conexión. Cambios fallidos muestran Reintentar sin jerga técnica.

## edge_cases

No sumar packs ni convertir a contenido interno sin tamaño y unidad verificados. Líneas duplicadas con IDs diferentes se conservan; IDs duplicados o ajenos al draft se rechazan. Fecha civil inválida, ambigua o futura requiere corrección o fallback explícito al día local de confirmación. Mappings del usuario prevalecen siempre; Por ubicar evita inventar ubicación. Pendientes tras confirmar enriquecen la fila existente, nunca crean otra.

## auth_secrets

Todas las operaciones privadas se autorizan por sesión y RLS. No confiar en userId enviado ni en raw/provenance/concept/stock suministrados sin validación. Catálogos globales se escriben solo con tooling privilegiado fuera del cliente. Mantener bucket privado y secretos server-only; no registrar PII del ticket. Voz/cámara solo tras acción del usuario; sin proveedor nuevo de audio.

## external_contracts

Reutilizar POST /api/ocr y almacenamiento de Sprint 5. Nuevas rutas GET /api/ocr/v2/drafts/[draftId], POST /api/ocr/v2/normalize, POST /api/ocr/v2/confirm y PATCH /api/ocr/v2/drafts/[draftId]/lines/[lineId]. Normalización determinista por mapping usuario, identificador exacto, alias exacto único y candidatos fuzzy solo dudosos. Importar exports locales versionados de cinco retailers; no scraping en el flujo interactivo. Fuente real copiada al repo: docs/catalogs/data/eroski_checkpoint.json, snapshot parcial con 23172 productos y checksum en docs/catalogs/local-sources.manifest.json; no inventar fetched_at. Exports finales de Eroski están vacíos. Cuatro retailers carecen de export localizado: adapters sobre contrato canónico y fixtures, estado ausente documentado. Aldi copiado para conservación pero su ingesta queda fuera del alcance R1. Ver docs/catalogs/R1_LOCAL_SOURCES.md.

## ui_states

PRODUCT_V3 reutiliza shell R0. /app/add-purchase con ticket principal y barcode/voz/manual secundarios; /app/add-purchase/[draftId] revisa solo dudosas y permite ver resueltas; /app/pantry busca y agrupa; /app/pantry/[itemId] edita. Referencias 01/06/08: rosa, crema, ciruela, coral, ámbar para incertidumbre, blancos cómodos y objetivos 44px. Sin datos de demostración dentro de la despensa real. Carga, vacío, sin resultados, error y offline con acciones visibles.

## rollback_compat

Flag server-only PRODUCT_V3 false conserva rutas, confirmación OCR y UI v2. Rutas /app/scan y /app/items/* siguen disponibles. RPC v3 separadas preservan el payload de v2; IndexedDB evoluciona aditivamente, cache/outbox separados por usuario. No reinterpretar expiry_date ni quantity legacy; no borrar datos, resetear DB, activar producción ni hacer backfill automático.

## tests

Unit tests de normalización/cantidades/fechas/importadores, pgTAP para aislamiento, integridad, replay/concurrencia y precedencia. Playwright con Vision mock y DB local: ticket limpio, tres dudosos, correction/unknown/omit, catálogo ausente, barcode y voz no disponibles, offline con reconexión/conflicto, dos usuarios, flag false, 320px. Comparación visual real en localhost frente a 01/06/08, capturas y diferencias documentadas. Harness gates más domain typecheck/tests, db lint y SQL; humo real con catálogo/ticket cuando estén disponibles.

## Scope propuesto

- `apps/web/src/app/(auth)/app/add-purchase/**`
- `apps/web/src/app/(auth)/app/pantry/**`
- `apps/web/src/components/purchase/**`
- `apps/web/src/components/pantry/**`
- `apps/web/src/lib/receipt/**`
- `apps/web/src/lib/normalization/**`
- `apps/web/src/lib/inventory/**`
- `packages/domain/src/pantry/**`
- `packages/domain/src/normalization/**`
- `scripts/catalogs/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/**`
- `docs/catalogs/**`
- `spec.json`
- `apps/web/src/app/api/ocr/**`
- `apps/web/src/app/(auth)/app/scan/**`
- `apps/web/src/components/receipt/**`
- `apps/web/src/components/navigation/product-v3-nav*`
- `apps/web/src/styles/product-v3.css`
- `apps/web/src/types/database.generated.ts`
- `packages/domain/src/receipt/**`
- `packages/domain/src/index.ts`
