# sprint-3-auth-and-account-migration · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [ ] (T1) Signup, login, verificación, solicitud/confirmación de reset y logout usan Supabase Auth con PKCE y cookies SSR.  ↔ R1
- [ ] (T2) Server Components/Actions obtienen la identidad mediante `getUser()`; ninguna ruta privada confía solo en cookies decodificadas o estado cliente.  ↔ R2
- [ ] (T3) `/app/*` redirige a login sin sesión válida y conserva únicamente un `returnTo` relativo y allowlisted.  ↔ R3
- [ ] (T4) Callbacks con código ausente/inválido y redirects externos terminan en un estado de error seguro, sin open redirect ni detalles sensibles.  ↔ R4
- [ ] (T5) La creación/actualización de `profiles` es idempotente por `auth.users.id`; cambiar email no rompe ownership.  ↔ R5
- [ ] (T6) El import de Firebase Auth identifica cuentas por Firebase UID y un rerun actualiza o reconoce la misma identidad sin duplicarla.  ↔ R6
- [ ] (T7) El dry-run informa conteos por enabled/disabled, emailVerified y provider sin escribir datos ni mostrar hashes, salts, tokens o parámetros secretos.  ↔ R7
- [ ] (T8) Los parámetros SCRYPT y credenciales administrativas solo se leen desde entorno/archivos ignorados y se redactan de logs y errores.  ↔ R8
- [ ] (T9) Si el hash puede importarse con tooling oficial se conserva la contraseña; si no, la cuenta queda marcada para reset sin inventar credenciales.  ↔ R9
- [ ] (T10) Email verification y disabled se mapean según reglas documentadas; una cuenta disabled no obtiene sesión de aplicación.  ↔ R10
- [ ] (T11) Recuperación y signup devuelven mensajes neutrales que no confirman si un email existe.  ↔ R11
- [ ] (T12) Tests cubren sesión expirada, callback inválido, redirect externo, aislamiento de dos usuarios, usuario disabled y rerun del import.  ↔ R12
- [ ] Tests que cubran los criterios de aceptación
