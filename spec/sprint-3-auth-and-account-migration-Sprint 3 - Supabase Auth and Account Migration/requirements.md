# sprint-3-auth-and-account-migration · undefined — Requisitos

- name: `Sprint 3 - Supabase Auth and Account Migration` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-19T10:09:29.140Z

## Contexto



## Requisitos funcionales

R1. Signup, login, verificación, solicitud/confirmación de reset y logout usan Supabase Auth con PKCE y cookies SSR.
R2. Server Components/Actions obtienen la identidad mediante `getUser()`; ninguna ruta privada confía solo en cookies decodificadas o estado cliente.
R3. `/app/*` redirige a login sin sesión válida y conserva únicamente un `returnTo` relativo y allowlisted.
R4. Callbacks con código ausente/inválido y redirects externos terminan en un estado de error seguro, sin open redirect ni detalles sensibles.
R5. La creación/actualización de `profiles` es idempotente por `auth.users.id`; cambiar email no rompe ownership.
R6. El import de Firebase Auth identifica cuentas por Firebase UID y un rerun actualiza o reconoce la misma identidad sin duplicarla.
R7. El dry-run informa conteos por enabled/disabled, emailVerified y provider sin escribir datos ni mostrar hashes, salts, tokens o parámetros secretos.
R8. Los parámetros SCRYPT y credenciales administrativas solo se leen desde entorno/archivos ignorados y se redactan de logs y errores.
R9. Si el hash puede importarse con tooling oficial se conserva la contraseña; si no, la cuenta queda marcada para reset sin inventar credenciales.
R10. Email verification y disabled se mapean según reglas documentadas; una cuenta disabled no obtiene sesión de aplicación.
R11. Recuperación y signup devuelven mensajes neutrales que no confirman si un email existe.
R12. Tests cubren sesión expirada, callback inválido, redirect externo, aislamiento de dos usuarios, usuario disabled y rerun del import.

## Restricciones

- **error_states:** Callback inválido, sesión expirada, cuenta disabled, hash no compatible e import parcial tienen resultado explícito y recuperable.
- **auth_secrets:** SCRYPT parameters, service role y export de Firebase viven solo en variables/archivos ignorados; nunca se imprimen ni llegan al navegador.
- **rollback_compat:** Firebase Auth sigue activo durante el ensayo; no se invalidan sesiones ni se hace cutover en este sprint.

