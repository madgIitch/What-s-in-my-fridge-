# sprint-11-pwa-install-offline-shell-and-push · undefined — Requisitos

- name: `Sprint 11 - PWA Install, Offline Shell and Web Push` · priority: P1 · sdd: true
- aprobado por: peorr · 2026-09-22T13:01:47.424Z

## Contexto



## Requisitos funcionales

R1. El manifest servido declara `name`, `short_name`, `start_url` bajo `/app`, `display: standalone`, `theme_color`, `background_color` e iconos PNG 192x192 y 512x512 tanto normales como `purpose: maskable`; una prueba valida presencia, MIME y dimensiones reales.
R2. El service worker usa nombres de caché versionados, precachea únicamente assets públicos y shell no sensible, elimina versiones obsoletas en `activate` y nunca almacena respuestas con `Set-Cookie`, solicitudes con `Authorization`, rutas `/api/**` ni documentos SSR autenticados.
R3. Los datos offline privados se guardan exclusivamente en almacenes IndexedDB particionados por `user_id`; logout o cambio de cuenta detiene workers y hace inaccesibles o elimina caché, outbox y datos del usuario anterior antes de renderizar la nueva sesión.
R4. Sin red, un usuario que ya abrió la aplicación puede cargar la shell y consultar datos previamente materializados; sin caché se muestra un estado no autoritativo y recuperable, y ninguna mutación pendiente se presenta como confirmada.
R5. La UI distingue de forma accesible estados offline sin caché, caché fechada, pending, synced, conflict, error recuperable y sesión expirada; conserva borradores y ofrece reintento sin fabricar éxito.
R6. La aplicación solo invoca `Notification.requestPermission()` dentro del manejador directo de una acción explícita del usuario; nunca lo hace al cargar, instalar, iniciar sesión ni recibir un evento automático.
R7. Alta y baja de una suscripción requieren sesión válida y protección same-origin/CSRF; cualquier `userId` recibido del cliente se ignora y el ownership se deriva exclusivamente de la sesión autenticada.
R8. La persistencia de suscripciones impone unicidad por endpoint canónico y ownership explícito; endpoint y claves no aparecen en logs, y VAPID private key, service role y demás secretos permanecen en módulos solo servidor sin prefijo `NEXT_PUBLIC_`.
R9. Cada entrega usa una clave idempotente estable ligada a evento, job y suscripción, protegida por una restricción única; dos ejecuciones concurrentes del mismo evento producen como máximo un intento aceptado por suscripción.
R10. Una notificación de finalización solo puede crearse después de validar Recipe JSON con el contrato versionado y confirmar en la fuente canónica que el job quedó committed como `completed`; estados intermedios, fallidos o transacciones revertidas no notifican.
R11. Una respuesta Push 404 o 410 marca revocada únicamente la suscripción correspondiente; 429, timeout y 5xx aplican reintento acotado con backoff, mientras errores terminales quedan registrados mediante códigos seguros sin secretos.
R12. El payload Push es versionado, mínimo y no contiene contenido privado; transporta un identificador opaco y una ruta relativa allowlisted, y el cliente obtiene cualquier detalle mediante una solicitud autenticada.
R13. `notificationclick` acepta exclusivamente rutas relativas normalizadas que comiencen por `/app` y estén en una allowlist; rechaza esquemas externos, URLs absolutas, valores protocol-relative, traversal y variantes codificadas, y reutiliza una ventana same-origin existente o abre una nueva.
R14. En navegadores sin Service Worker, Push, Notifications, `beforeinstallprompt` o Share Target, inventario, recetas, paste URL y consulta de jobs mediante polling siguen funcionando; la interfaz muestra estado neutral y no presenta controles imposibles.
R15. Share Target redirige a la pantalla autenticada de importación con entrada validada; si no existe sesión conserva solo una referencia no sensible durante el flujo de login y nunca sustituye la ruta manual de paste URL.
R16. Push es una aceleración informativa y no la fuente de verdad: tras abrir o enfocar la app, el estado del job se obtiene desde el backend mediante query/polling y converge aunque la notificación no llegue, llegue tarde o se duplique.
R17. El rollback puede desactivar Push, instalación promocionada y Share Target mediante flags sin eliminar datos; las migraciones son aditivas, los service workers anteriores se actualizan limpiamente y paste URL más polling permanecen operativos.
R18. Las pruebas unitarias o de integración verifican filtros de caché, aislamiento por usuario, validación de rutas, ownership derivado de sesión, secreto solo servidor, idempotencia bajo concurrencia y revocación selectiva 404/410.
R19. Las pruebas E2E cubren instalación y prompt cuando el navegador permita emularlos, primer arranque offline, offline con datos materializados, acciones pendientes, fallback sin APIs, Push mock, click seguro y rechazo de caché para `/api`, cookies y SSR autenticado.
R20. La suite ejecuta al menos Chromium para APIs PWA y casos de degradación en WebKit y Firefox; las capacidades no emulables se prueban en el nivel de integración y quedan explícitamente documentadas, sin omitir silenciosamente la cobertura.

## Restricciones

- **error_states:** Se clasifican como terminales permiso denegado, 401/403, payload inválido y configuración/VAPID inválida; 404/410 revocan únicamente la suscripción afectada; timeout, red, 429 y 5xx admiten como máximo tres intentos con backoff y jitter. La UI diferencia `denied`, `unsupported` y error recuperable, conserva borradores/outbox offline y no confirma mutaciones antes del commit.
- **auth_secrets:** Alta y baja requieren sesión Supabase, `Origin` same-origin y JSON estricto; cualquier `userId` del cliente se ignora. `VAPID_PRIVATE_KEY` y service role son exclusivamente server-side y solo `NEXT_PUBLIC_VAPID_PUBLIC_KEY` puede ser pública. Endpoints, claves, cookies, cabeceras de autorización y payloads privados quedan excluidos de logs, errores, fixtures y bundles.
- **rollback_compat:** Flags server-only independientes permiten desactivar promoción de instalación, alta/envío Push y Share Target sin borrar datos. Las cachés tienen versión explícita y `activate` elimina solo versiones conocidas del shell; las migraciones son aditivas y paste URL más polling permanecen siempre disponibles, sin down migrations durante rollback.

