# sprint-13-ui-parity-responsive-and-accessibility · undefined — Requisitos

- name: `Sprint 13 - UI Parity, Responsive and Accessibility` · priority: P1 · sdd: true
- aprobado por: peorr · 2026-09-25T14:56:29.843Z

## Contexto



## Requisitos funcionales

R1. No queda ninguna pantalla legacy incluida en scope sin ruta o sustituto documentado.
R2. No existe overflow horizontal involuntario a 320, 375, 430, 768, 1024 y 1440 px.
R3. Acciones principales tienen target de al menos 44x44 CSS px o área equivalente.
R4. Formularios son usables con teclado y foco visible.
R5. Diálogos de confirmación/crop/paywall gestionan foco y Escape cuando corresponde.
R6. Loading, offline, error, pending sync y conflict se distinguen por texto/semántica además de color.
R7. Las rutas privadas preservan deep links después de login mediante returnTo allowlisted.
R8. Las pantallas críticas no tienen infracciones axe critical/serious en los estados cubiertos.
R9. La navegación PWA no depende de gestos nativos inexistentes en navegador.
R10. Playwright cubre auth -> inventory -> scan mock -> review -> recipes -> favorite -> calendar -> paywall.

## Restricciones

- **error_states:** Loading, vacío, offline, error, pendiente y conflicto tienen texto, semántica y acción recuperable; sesión expirada conserva returnTo local.
- **auth_secrets:** Las rutas privadas conservan deep links con safeReturnTo /app/**; no se expone información privada en estados de error.
- **rollback_compat:** Cambios de UI dentro de apps/web y packages/ui, sin alterar contratos de dominio ni migraciones. Mantener rutas existentes como enlaces funcionales.

