# sprint-1-supabase-platform-foundation · undefined — Requisitos

- name: `Sprint 1 - Supabase Platform Foundation` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-17T22:37:39.006Z

## Contexto



## Requisitos funcionales

R1. Una base vacía alcanza el schema esperado ejecutando únicamente migraciones versionadas.
R2. El cliente de navegador solo utiliza URL y publishable key; el cliente privilegiado solo existe en módulos server-only.
R3. Una ruta privada de prueba valida sesión server-side y redirige a `/login` cuando no existe usuario.
R4. Dos usuarios de test no pueden SELECT/INSERT/UPDATE/DELETE filas del otro en ninguna tabla privada creada en el sprint.
R5. Un usuario no puede leer ni sobrescribir objetos de otro usuario en Storage; los paths comienzan por su UUID.
R6. La service/secret key no aparece en HTML, bundles, source maps, logs o respuestas.
R7. Los tipos generados forman parte del build y `pnpm typecheck` falla si sus consumidores divergen del schema.
R8. `supabase db lint` y el test RLS/Storage terminan con código 0 contra Supabase local.
R9. Local, preview/staging y production usan proyectos/secretos separados y la documentación prohíbe reutilizar service roles.

## Restricciones

- **error_states:** auth ausente redirige; configuración server incompleta falla de forma explícita; RLS deniega por defecto.
- **auth_secrets:** browser usa URL y publishable key; service role solo en módulo server-only y nunca es necesaria para renderizar la shell.
- **rollback_compat:** cambios aditivos; no se modifica Firebase ni el cliente móvil y las migraciones pueden resetearse en local.

