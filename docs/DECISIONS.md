# Decisiones (ADR)

Formato por entrada: **fecha · título** — contexto, decisión y consecuencias.
El harness añade entradas cuando se aprueba un spec; el agente también debe añadir entradas cuando toma
una decisión de arquitectura relevante durante implementación.

## Pendientes de decisión

- Proveedor concreto de transcripción y extracción tras las interfaces definidas.
- Política final de conflictos offline y periodos de retención, a decidir en sus sprints.

<!-- Nuevas entradas debajo -->

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
