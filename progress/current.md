# Sesión actual

## 8 de octubre de 2026 · R3 cerrado por petición del usuario

R2 cerrado por indicación explícita del usuario. R3 (`sprint-r3-cook-library-and-import-bridge`) aprobado antes de implementar y cerrado como done por petición explícita del usuario. Biblioteca Cocinar, disponibilidad de imports privados, cantidades desconocidas, compra/guardado transaccionales e importación recuperable implementados dentro del scope.

Gates harness, build, 178 pruebas web, 43 de dominio y typecheck, 290 aserciones SQL, DB lint, concurrencia y Playwright v3/rollback pasan. Evidencia: progress/review_sprint-r3-cook-library-and-import-bridge.md y docs/design/neverita-v3/qa/R3_COMPARISON.md. Migración aditiva aplicada solo local; sin reset, despliegue ni SQL remoto. Implementación subida a origin/main en fdb2938.

Siguiente acción: preparar el spec R4 para aprobación. El cierre solicitado no aporta evidencia adicional de smoke humano. La activación general mantiene pendientes benchmark humano y smoke real Whisper/GCS; completed no certifica fidelidad. No se inicia R4 sin su spec aprobado.

## Contexto anterior

## 2 de octubre de 2026 · migración remota del hotfix de Hoy

Por petición explícita del usuario se aplicó `20261002000200_today_state_key_revision.sql` al proyecto enlazado `bwscshjtwmsfscbjbndq`. El dry-run previo confirmó que era la única migración pendiente; no se aplicaron seeds ni roles. La prueba local `017_today_state_key_revision.test.sql` pasó sus cinco aserciones y `db lint --linked --schema public --level warning --fail-on warning` terminó sin errores. R2 conserva su estado de revisión humana pendiente.

El fallo posterior de CI en `Check generated types match schema` se corrigió añadiendo `today_catalog_revision` a `database.generated.ts`. El diff y el hash del archivo (`8f92e0d`) coinciden con la salida del generador en CI. La regeneración local no pudo ejecutarse porque Docker no estaba disponible; no se hizo reset de la base.

**sprint-r2-today-decision-engine** implementado y en `review_pending`, con `spec_approved: true`. Hoy automático, ranking conservador sin cuota, cantidades inciertas y compra confirmada con snapshot vigente y replay. Onboarding aislado, offline honesto y TTMD sin datos privados.

Gates harness PASS; build PASS; 37 pruebas de dominio y typecheck PASS; 252 aserciones SQL y db lint PASS. Playwright: cuatro recorridos R2 con flag true y rollback false por separado. Concurrencia local PASS. Evidencia: progress/review_sprint-r2-today-decision-engine.md y docs/design/neverita-v3/qa/R2_COMPARISON.md.

Pendiente: revisión humana y cierre explícito del spec. La migración se aplicó solo en local. No despliegue, push ni cambios R3–R8. Se preservan los arreglos R1 del botón + y del dictado.

## R1 y antecedente de ejecución

R1 cerrado por petición explícita del usuario el 1 de octubre de 2026. Implementación 6ce5b59, navegación 6afe708 y dictado c85a6cf subidos a origin/main. Smoke con ticket/cámara/voz reales pendiente.

En R1 un ejecutor hizo por error supabase db reset --local, prohibido por el spec. Se comunicó al usuario; no afectó al remoto. R2 no repitió el reset: solo migración aditiva y fixtures locales, con rollback en pruebas SQL.
