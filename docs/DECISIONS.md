# Decisiones (ADR)

Formato por entrada: **fecha · título** — contexto, decisión y consecuencias.
El harness añade entradas cuando se aprueba un spec; el agente también debe añadir entradas cuando toma
una decisión de arquitectura relevante durante implementación.

## Pendientes de decisión

- Proveedor concreto de transcripción y extracción tras las interfaces definidas.
- Política final de conflictos offline y periodos de retención, a decidir en sus sprints.

<!-- Nuevas entradas debajo -->

## 2026-09-20 · Reserva OCR en dos fases y confirmación exactamente una vez

La cuota mensual se reserva bajo bloqueo en PostgreSQL antes de preparar el objeto, se libera si el flujo falla antes de Vision y se convierte en consumo justo antes de invocar al proveedor. Desde ese instante, éxito o fallo facturable consume exactamente una unidad. La confirmación bloquea el draft y deriva IDs deterministas de `(draft_id, line_id)`, de modo que retries y carreras devuelven el primer resultado canónico sin duplicar inventario. Las imágenes permanecen en un bucket privado bajo `auth.uid()/draft_id`; cualquier URL firmada dura 60 segundos y no se persiste.

## 2026-09-17 · Plano interactivo y plano de media separados

La PWA y su orquestación interactiva se despliegan en Vercel; Supabase conserva el estado canónico de aplicación; Google Cloud Tasks y Cloud Run ejecutan las cargas de vídeo/audio e IA. Vercel no descarga ni transcodifica vídeo y Railway queda fuera de la arquitectura 1.0. Esto permite límites, escalado y observabilidad independientes sin introducir una cuarta plataforma.

## 2026-09-17 · Migración strangler sin alterar el cliente móvil

La nueva PWA vive en `apps/web` junto al cliente Expo existente. El legado sirve de referencia hasta que los verticales hayan alcanzado paridad, la migración sea reconciliable y exista rollback probado. Cada contrato funcional se mueve solo en el sprint que lo aprueba.

<!-- harness:sprint-0-pwa-migration-foundation -->
## 2026-09-17 · sprint-0-pwa-migration-foundation aprobado

Contexto: se aprobó el spec `sprint-0-pwa-migration-foundation` (Sprint 0 - PWA Migration Foundation).

Decisión: implementar según el spec aprobado.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-1-supabase-platform-foundation -->
## 2026-09-17 · sprint-1-supabase-platform-foundation aprobado

Contexto: se aprobó el spec `sprint-1-supabase-platform-foundation` (Sprint 1 - Supabase Platform Foundation).

Decisiones registradas:

- **auth_secrets:** browser usa URL y publishable key; service role solo en módulo server-only y nunca es necesaria para renderizar la shell.
- **rollback_compat:** cambios aditivos; no se modifica Firebase ni el cliente móvil y las migraciones pueden resetearse en local.
- **tests:** SQL tests prueban CRUD horizontal con dos usuarios y aislamiento de Storage; TypeScript valida separación y tipos generados.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-2-domain-schema-and-migration-mapping -->
## 2026-09-19 · sprint-2-domain-schema-and-migration-mapping aprobado

Contexto: se aprobó el spec `sprint-2-domain-schema-and-migration-mapping` (Sprint 2 - Domain Schema and Migration Mapping).

Decisiones registradas:

- **auth_secrets:** Todas las tablas privadas derivan acceso de auth.uid() mediante RLS; el schema y seeds no requieren ni exponen service role al navegador.
- **rollback_compat:** Migración aditiva, sin modificar ni retirar Firebase o el cliente móvil; cachés no autoritativas se reconstruyen y los registros importados conservan source/legacy_id.
- **tests:** pgTAP con dos usuarios verifica RLS y constraints; tests de dominio validan mappings; seeds se prueban por rerun, cardinalidad y checksum.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-3-auth-and-account-migration -->
## 2026-09-19 · sprint-3-auth-and-account-migration aprobado

Contexto: se aprobó el spec `sprint-3-auth-and-account-migration` (Sprint 3 - Supabase Auth and Account Migration).

Decisiones registradas:

- **auth_secrets:** SCRYPT parameters, service role y export de Firebase viven solo en variables/archivos ignorados; nunca se imprimen ni llegan al navegador.
- **rollback_compat:** Firebase Auth sigue activo durante el ensayo; no se invalidan sesiones ni se hace cutover en este sprint.
- **tests:** Unit/integration cubren redirects allowlisted y errores; pgTAP cubre perfiles; fixtures sintéticos cubren dry-run, rerun y fallback sin secretos reales.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-4-inventory-offline-first -->
## 2026-09-19 · sprint-4-inventory-offline-first aprobado

Contexto: se aprobó el spec `sprint-4-inventory-offline-first` (Sprint 4 - Inventory Offline-First).

Decisiones registradas:

- **auth_secrets:** La sesión Supabase y RLS basada en auth.uid() aíslan todos los datos. El RPC deriva user_id exclusivamente de auth.uid() y no acepta ownership suministrado por el cliente. La publishable/anon key puede ser pública y la service role permanece exclusivamente server-only. pgTAP verifica que un usuario no puede observar ni mutar inventory_items o client_mutations ajenos.
- **rollback_compat:** Los cambios SQL e IndexedDB son aditivos y Firebase, WatermelonDB y Expo permanecen intactos. Los stores y campos nuevos se versionan para que una PWA anterior pueda ignorarlos sin eliminar caché, outbox ni tombstones. El logout desvincula los datos locales de la UI y del worker; otro usuario no puede verlos ni procesarlos. La purga local y la compactación de tombstones quedan fuera de este sprint y requieren políticas posteriores aprobadas.
- **tests:** Playwright usa Supabase local, dos usuarios, dos páginas o contextos y control determinista de conectividad. Los tests unitarios cubren transacciones y compactación Dexie, coordinación entre pestañas, cursor incremental y fechas civiles. pgTAP cubre RLS, deduplicación, compare-and-swap, incremento de versión y tombstones. El E2E verifica UI, IndexedDB y filas canónicas, incluida recarga offline y viewport de 320 px.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.

<!-- harness:sprint-5-receipt-ocr-and-draft-review -->
## 2026-09-20 · sprint-5-receipt-ocr-and-draft-review aprobado

Contexto: se aprobó el spec `sprint-5-receipt-ocr-and-draft-review` (Sprint 5 - Receipt OCR and Draft Review).

Decisiones registradas:

- **auth_secrets:** Las URLs firmadas se emiten exclusivamente en servidor tras validar sesión y ownership, quedan limitadas a lectura de un objeto durante 60 segundos y no se persisten. Se define una política explícita de redacción para credenciales, sesión, URLs, imágenes, OCR y datos personales.
- **rollback_compat:** Los cambios quedan limitados a extensiones SQL/Storage aditivas y rutas PWA nuevas, sin alterar contratos legacy. El rollback conserva drafts, cuotas e imágenes, evita down migrations destructivas y exige una política documentada de expiración que no elimine objetos todavía necesarios.
- **tests:** Se concretan fixtures sintéticos versionados y pruebas unitarias, de integración, pgTAP/Storage y Playwright. La cobertura incluye RLS entre usuarios, MIME real, cuotas concurrentes, replay, confirmación exactamente una vez, rollback transaccional, redacción, ausencia de secretos y verificación de UI, Storage y filas canónicas.

Consecuencia: futuras features deben respetar este contrato salvo nuevo ADR.
