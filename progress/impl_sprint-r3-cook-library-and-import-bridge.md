# R3 · implementación

8 de octubre de 2026. Spec aprobado explícitamente antes de implementar.

Biblioteca Cocinar con tres colecciones, paginación ligada a usuario y versión,
proyección privada de imports/revisiones aceptadas y disponibilidad conservadora
sobre el motor R2. No se publica ninguna importación en el catálogo global.

Compra y guardado usan RPC transaccionales con validación autoritativa, replay,
conflictos y deduplicación. Los favoritos conservan snapshots inmutables;
cantidades desconocidas permanecen null. Retry reutiliza job y reserva de cuota.
Sesión, cancelación de respuestas, offline, Origin y JSON estricto protegen los
flujos de cliente y servidor. PRODUCT_V3=false conserva el recorrido v2.

Migración aditiva 20261008000100 aplicada solo en Supabase local, tipos
regenerados y funciones verificadas. Se corrigió el orden de bloqueos para
evitar un ciclo entre lectura de biblioteca y guardado de otra cuenta.

Gates harness PASS (typecheck, lint sin warnings, tests y diff-scope); web 178
pruebas en 45 archivos; dominio 43 en cinco archivos y typecheck; build PASS;
pgTAP 290 aserciones en 14 archivos y DB lint PASS. Concurrencia: cinco controles
PASS, incluyendo replay y lectura/guardado entre cuentas. Playwright: cuatro
recorridos v3 y un rollback separado PASS. Capturas reales 320/393 verificadas.

Dos tests SQL anteriores ahora filtran sus propios usuarios de fixture, para
que datos sintéticos persistidos por E2E no alteren sus aserciones globales.
Worker/Python y lockfile no cambiaron: no requieren suites ni instalación
adicionales para este diff.

La evidencia externa simulada y los gates humanos pendientes se detallan en
docs/design/neverita-v3/qa/R3_COMPARISON.md. No push, despliegue ni SQL remoto.
