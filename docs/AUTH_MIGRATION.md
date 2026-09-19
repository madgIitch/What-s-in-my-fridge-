# Migración de Firebase Auth a Supabase Auth

La identidad relacional es siempre `auth.users.id`. El Firebase UID original se conserva como `legacy_id_map(entity_type='auth_user', legacy_id=<uid>, target_id=<auth.users.id>)`; el email nunca actúa como foreign key y puede cambiar.

## Ensayo seguro

1. Exportar usuarios con el tooling oficial `supabase-community/firebase-to-supabase` en un entorno aislado.
2. Guardar fuera del repositorio el export, la conexión objetivo y los parámetros Firebase SCRYPT (`base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`).
3. Ejecutar primero `node scripts/migration/auth/dry-run.mjs <users.json>`. Solo imprime cardinalidades enabled/disabled, verificación, providers y casos que requieren reset.
4. Reconciliar Firebase UID contra `legacy_id_map`. Un UID ya mapeado es `already_imported`; nunca se crea otra identidad basándose en el email. Tras importar, ejecutar `link-identities.mjs <uid-map.json>` con pares `{firebaseUid,supabaseUserId}`; el RPC rechaza reasignar un UID y el rerun es idempotente.
5. En staging, configurar las variables `MIGRATION_*`, fijar `MIGRATION_CONFIRM_WRITE=IMPORT_FIREBASE_AUTH` y ejecutar `run-official-import.mjs`. El wrapper rechaza producción; el cutover final tendrá tooling y aprobación separados.

Supabase documenta su importador específico de Firebase para conservar SCRYPT. El Admin API genérico solo debe usarse para hashes compatibles (bcrypt/Argon2); si una credencial Firebase no se puede importar, se crea el usuario sin contraseña inventada y se marca `reset_required`.

## Mapping

- `emailVerified=true` → email confirmado.
- `disabled=true` → cuenta bloqueada; no obtiene sesión de aplicación.
- providers federados se contabilizan por `providerId` y se reconfiguran explícitamente antes del cutover.
- usuarios sin hash compatible → recuperación neutral por email.

Firebase permanece activo durante el ensayo. Las sesiones existentes solo se invalidarán en la ventana de cutover, después de reconciliar cuentas y probar login previo/reset en staging.
