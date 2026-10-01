# Sesión actual

**sprint-r2-today-decision-engine** implementado y en `review_pending`, con `spec_approved: true`. Hoy automático, ranking conservador sin cuota, cantidades inciertas y compra confirmada con snapshot vigente y replay. Onboarding aislado, offline honesto y TTMD sin datos privados.

Gates harness PASS; build PASS; 37 pruebas de dominio y typecheck PASS; 252 aserciones SQL y db lint PASS. Playwright: cuatro recorridos R2 con flag true y rollback false por separado. Concurrencia local PASS. Evidencia: progress/review_sprint-r2-today-decision-engine.md y docs/design/neverita-v3/qa/R2_COMPARISON.md.

Pendiente: revisión humana y cierre explícito del spec. La migración se aplicó solo en local. No despliegue, push ni cambios R3–R8. Se preservan los arreglos R1 del botón + y del dictado.

## R1 y antecedente de ejecución

R1 cerrado por petición explícita del usuario el 1 de octubre de 2026. Implementación 6ce5b59, navegación 6afe708 y dictado c85a6cf subidos a origin/main. Smoke con ticket/cámara/voz reales pendiente.

En R1 un ejecutor hizo por error supabase db reset --local, prohibido por el spec. Se comunicó al usuario; no afectó al remoto. R2 no repitió el reset: solo migración aditiva y fixtures locales, con rollback en pruebas SQL.
