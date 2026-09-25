# Sprint 11: PWA y Web Push

## Despliegue

- Aplicar la migración `20260922000300_pwa_push.sql` antes de activar Push.
- Configurar `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PUBLIC_KEY` con la misma clave pública, además de `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` si se activa Push. La clave privada permanece solo en servidor.
- No hay cron de Vercel. `/api/push/dispatch` permanece disponible para una invocación autorizada con `CRON_SECRET`, pero no se ejecuta automáticamente. Las pantallas consultan el estado canónico por polling aunque no llegue una notificación Push.
- `PUSH_ENABLED=false`, `PWA_INSTALL_PROMOTION_ENABLED=false` y `SHARE_TARGET_ENABLED=false` desactivan las funciones promocionadas sin migración inversa.

## Datos locales y notificaciones

El service worker guarda únicamente el manifest, iconos, `offline.html`, `offline.js` y assets públicos. La pantalla offline lee la partición IndexedDB del usuario activo y muestra fecha y estado pendiente; no considera confirmados los cambios locales. La baja de Push se intenta antes del cierre de sesión y el navegador se desuscribe incluso sin red.

El despachador reclama una entrega en la base y vuelve a leer el job confirmado. Solo envía cuando la versión y el resultado `recipe-v1` siguen siendo válidos. Los rechazos 404/410 revocan esa suscripción; 429, 5xx y errores de red admiten hasta tres intentos. El contenido Push solo contiene versión, tipo, ID de evento opaco y ruta relativa permitida.

## Verificación local

- `pnpm --dir apps/web typecheck`, `lint`, `test`, `build` y `check:env`.
- `pnpm --dir apps/web exec playwright test pwa-install-offline push-safe-click` ejecuta los casos del sprint en Chromium, Firefox y WebKit. En este host Windows, Firefox no puede iniciar (`spawn UNKNOWN`) y Playwright WebKit no intercepta de forma fiable la navegación sin red; los casos se omiten con motivo explícito. WebKit sí prueba el lector IndexedDB con `offline.html`; Chromium prueba la navegación offline completa. En Linux CI deben ejecutarse sin esas omisiones.
- La migración y pgTAP necesitan Docker Desktop o una instancia Supabase de pruebas. No se verificaron localmente mientras el motor Docker estuvo apagado.

Antes de dar el sprint por cerrado, comprobar en entorno de prueba un job real completado, la entrega en un dispositivo suscrito, 404/410, reintento, cambio de cuenta y el flujo Share Target desde una app móvil.
