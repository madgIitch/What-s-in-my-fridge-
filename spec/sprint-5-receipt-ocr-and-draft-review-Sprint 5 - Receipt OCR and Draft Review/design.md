# sprint-5-receipt-ocr-and-draft-review · undefined — Diseño

## Scope (archivos que puede tocar)

- `apps/web/src/app/**/receipt*/**`
- `apps/web/src/app/api/ocr/**`
- `apps/web/src/components/receipt/**`
- `apps/web/src/lib/receipt/**`
- `apps/web/src/lib/vision/**`
- `apps/web/src/lib/supabase/**`
- `apps/web/src/types/database.generated.ts`
- `packages/domain/src/receipt/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/fixtures/receipts/**`
- `tests/e2e/receipt-ocr*.spec.ts`
- `apps/web/.env.example`
- `docs/**`
- `spec.json`

## Enfoque

- **data_model:** Se define una extensión aditiva de receipt_drafts con estados persistidos, referencia privada de imagen, identificador idempotente, versión del parser, snapshots OCR, líneas originales y editadas, errores, periodo de cuota y confirmación. La confirmación usa una RPC transaccional con bloqueo, IDs deterministas y constraints únicas para devolver un resultado canónico sin duplicados ni efectos parciales.
- **external_contracts:** Se fija una autoridad server-side única para entitlement Free/Pro y un adaptador Vision versionado con entrada validada, request_id, timeout de 15 segundos, un único retry interno transitorio, límite de respuesta, salida normalizada y mock determinista sin red.
- **edge_cases:** Se cubren corrupción y dimensiones inválidas, orientación EXIF, eliminación de metadata, cancelación del crop, locales, fechas e importes ambiguos, moneda sin evidencia y líneas parcialmente reconocidas. Los campos inciertos permanecen nulos y editables en vez de ser inventados.
- **ui_states:** Se especifican los estados visibles desde selección hasta confirmación, las acciones habilitadas o bloqueadas, las rutas de recuperación y el tratamiento de OCR vacío y cuota agotada. También se definen live regions, gestión de foco y la prohibición de mostrar éxito antes del commit canónico.

## Decisiones de la entrevista

- **adv-bd7167bbd8:** ### [adv-9ad1722add] No se especifican las rutas ni los contratos request/response de upload, OCR y confirmación, incluidos códigos de error observables.

**R:**
- **adv-f39c1b93c1:** ### [adv-f0c67bcc69] No se enumeran los casos legacy ni el corpus de referencia que determina la «igualdad semántica» exigida al parser.

**R:**
- **adv-48deb3f8e9:** ### [adv-586c63d676] No se define el alcance de request_id: formato, quién lo genera, ni qué debe ocurrir si se reutiliza para el mismo usuario y draft con una imagen o payload diferente.

**R:**
- **adv-9cb4107d34:** ### [adv-daa5ce31d6] Queda abierta explícitamente la decisión de si un fallo facturable de Vision consume cuota o libera la reserva.

**R:**
- **adv-9104601404:** ### [adv-8a02d16121] No se especifica el TTL requerido para las URLs firmadas.

**R:**
- **adv-b9c3dc0e70:** ### [adv-3563ad5ed8] No se define qué campos y validaciones admite la edición de una línea ni cómo se representa inequívocamente una línea aceptada o excluida al confirmar.

**R:**
- **data_model:** Extender `receipt_drafts` de forma aditiva con `status` (`pending|processing|review|failed|confirmed`), `image_path`, `ocr_request_id`, `parser_version`, snapshot OCR, líneas originales y líneas editadas/aceptadas, `error_code`, `quota_period`, `confirmed_at` y timestamps. `ocr_request_id` es UUID único por `(user_id, ocr_request_id)` y el resultado se persiste para replays. Las líneas conservan texto original y campos normalizados por separado. Una RPC transaccional bloquea el draft, exige `confirmed_at IS NULL`, crea items con IDs deterministas ligados a draft/línea, marca `confirmed` y devuelve siempre el resultado canónico; constraints únicas evitan duplicados incluso con concurrencia.
- **error_states:** Contrato JSON estable `{code,message,retryable,requestId}` sin detalles sensibles. HTTP: 400 `INVALID_IMAGE`/`INVALID_REQUEST`, 401 `AUTH_REQUIRED`, 403 `OBJECT_FORBIDDEN`, 404 `DRAFT_NOT_FOUND`, 409 `DRAFT_STATE_CONFLICT`, 413 `IMAGE_TOO_LARGE`, 422 `OCR_EMPTY` o `OCR_INVALID_RESPONSE` (el primero abre revisión vacía), 429 `OCR_QUOTA_EXHAUSTED`, 502 `VISION_UNAVAILABLE`, 504 `VISION_TIMEOUT`. Solo `VISION_UNAVAILABLE`, `VISION_TIMEOUT` y fallos de red son reintentables con el mismo request_id; replay devuelve el resultado persistido. Validación previa no reserva cuota; tras invocar Vision, la reserva se confirma aunque Vision falle para reflejar coste externo, y el retry idempotente no vuelve a consumir ni llamar a Vision. Confirmación es atómica y nunca deja efectos parciales.
- **edge_cases:** Aplicar orientación EXIF antes del crop y eliminar metadata al recomprimir. Cancelar crop vuelve a selección sin upload. El parser recibe locale explícito con fallback `es-ES`, normaliza fechas solo cuando son inequívocas a `YYYY-MM-DD`, importes a unidades decimales con punto y moneda ISO cuando exista evidencia; nunca inventa moneda/fecha/total ambiguos. Una línea parcial conserva `rawText`, campos reconocidos nullable, confidence y motivo en `unrecognizedLines`; el usuario puede corregirla o excluirla. Archivos corruptos o sin dimensiones válidas se rechazan antes de Storage/Vision.
- **auth_secrets:** Las URLs firmadas son de lectura, para un único objeto, emitidas server-side tras comprobar sesión y ownership, con TTL de 60 segundos; no se persisten ni se devuelven si no son necesarias para la UI. Logs, trazas y errores redactan Authorization, cookies, service-role/Vision credentials, query strings de URLs firmadas, bytes de imagen, texto OCR completo y datos personales del ticket. Solo se registran request_id, draft_id, códigos, duraciones, contadores y tamaños no sensibles.
- **external_contracts:** Hasta Sprint 10, `profiles.plan`/entitlement server-side existente o, si aún no existe, una tabla aditiva `user_entitlements` con default `free` y acceso solo vía RPC server-side es la única autoridad; el cliente nunca decide Pro. El adaptador Vision versionado recibe bytes validados, MIME y request_id, usa timeout de 15 s, como máximo un retry interno para errores transitorios y devuelve texto/anotaciones normalizadas con límite de respuesta; credenciales quedan server-only. Respuesta inválida produce `OCR_INVALID_RESPONSE`. Tests inyectan un mock determinista sin red mediante la misma interfaz.
- **ui_states:** Estados visibles y accesibles: selección (cámara/archivo), crop con cancelar/rotar/confirmar, uploading y processing con progreso indeterminado y controles de nueva ejecución bloqueados, review con líneas editables/aceptables, empty OCR con entrada manual, quota exhausted sin retry OCR pero con navegación segura, fallo retryable con reintento del mismo request_id, fallo terminal con volver a selección, confirming con submit bloqueado y confirmed con enlace al inventario. Mensajes usan live regions, foco se mueve al error o encabezado del nuevo estado, y ningún estado comunica éxito antes del commit canónico.
- **rollback_compat:** Solo cambios SQL/Storage aditivos y rutas PWA nuevas. No modificar ni retirar Scan/Crop/ReviewDraft de Expo, Firebase Functions/Storage ni contratos legacy. Un deployment web anterior debe ignorar tablas, columnas y objetos nuevos; rollback consiste en volver al deployment anterior conservando drafts, cuotas e imágenes. No se ejecutan down migrations destructivas ni cleanup global; objetos temporales expiran por política documentada y nunca antes de que el draft deje de necesitarlos.
- **tests:** Crear fixtures sintéticos versionados a partir de cada forma soportada por el parser legacy (comercio/fecha/moneda/total, separador coma y punto, líneas con cantidad/precio/descuento, texto parcial y OCR vacío), sin tickets reales ni PII. Unit: parser, orientación/normalización, firma MIME, límites e idempotencia. Integración: adaptador Vision mock, códigos/retries, redacción y ausencia de secretos en bundle. pgTAP/Storage con dos usuarios: RLS/list/read/delete/sign, cuota mensual y concurrencia, ownership, replay y confirmación exactamente una vez/rollback. Playwright móvil: cámara no disponible, upload/crop, processing, review/edit/exclude, empty OCR, confirm/doble submit, cuota agotada y error retryable, comprobando UI, Storage y filas canónicas.

