# Sesión actual

Feature: **sprint-11-pwa-install-offline-shell-and-push** — implementación en revisión.

Manifest e iconos PNG, service worker con caché pública, lector de inventario local sin conexión, limpieza de IndexedDB al cambiar de cuenta, Share Target y alta/baja de suscripciones Push implementados. La migración crea suscripciones y entregas con idempotencia por evento; el despachador autenticado por `CRON_SECRET` relee job y propietario antes de enviar y aplica reintentos acotados. La configuración y los límites operativos están en `docs/PWA_PUSH.md`.

## Verificación

- Web: typecheck, lint, 109 tests, build y checks de boundaries/env/Supabase aprobados.
- E2E PWA/Push: 8 aprobados, 4 omisiones documentadas por límites de Playwright en Windows. Chromium valida navegación offline; WebKit valida lectura de datos locales; Firefox ejecuta el caso API sin navegador.
- SQL/pgTAP: reset local completo, 176 tests y lint del esquema `public` aprobados.

## Siguiente acción

- Publicar el commit y comprobar el despliegue de la migración en staging. Probar allí un Push real, Share Target y cambio de cuenta. No cerrar el sprint antes de esos smoke tests.
