# Sprint 12 — propuesta de migración y reconciliación

Estado: **borrador para aprobación**. `spec_approved` sigue en `false`; no se ejecutará un import con datos reales hasta aprobar el spec.

## Alcance y fuente

- El ensayo lee **directamente Firestore** del proyecto confirmado `what-s-in-my-fridge-a2a07`, con credenciales de solo lectura. La fase `capture` pagina por ruta documental estable y crea fuera del repositorio una copia JSONL inmutable, con manifiesto de proyecto, fecha de captura, colecciones, número de documentos y SHA-256 por archivo. Ninguna fase escribe en Firebase.
- El formato canónico intermedio es JSONL por colección, con ruta Firestore completa, Firebase UID, fecha de actualización y payload. Una segunda lectura de metadatos detecta cambios ocurridos durante la captura; si hay drift, el run no se considera reconciliado y exige recaptura.
- No hay export de los borradores y datos que solo viven en WatermelonDB. El reporte marca esa fuente como `not_available` y la reconciliación global como `partial`, aunque las colecciones Firestore importadas cuadren. No inventa filas locales ausentes.
- El import de Auth del Sprint 3 debe haberse ejecutado: cada UID se resuelve mediante `legacy_id_map(entity_type='auth_user')`. El email nunca es clave de unión.

## Contrato de comandos

`node scripts/migration/data/run.mjs <capture|plan|dry-run|import|reconcile> --environment <local|staging> --source-project <id> --snapshot <ruta> --report-dir <ruta>`.

- `capture` exige el project ID exacto `what-s-in-my-fridge-a2a07` y `--confirm-source-read READ_FIRESTORE_LEGACY`; lee Firestore por lotes y escribe el snapshot local inmutable. `plan` valida estructura y checksums sin tocar Supabase. `dry-run` lee mappings y simula transformaciones sin escribir datos.
- `import` en staging exige `--confirm-write IMPORT_FIREBASE_DATA_STAGING`; local exige entorno explícito. Los destinos Supabase de producción se rechazan. El origen Firestore confirmado se permite solo para lectura. El cutover de producción tendrá un comando y una aprobación separados.
- Un checkpoint de captura guarda colección y última ruta confirmada. Un checkpoint de import guarda colección, cursor/ruta del último documento confirmado, checksum del snapshot y versión del transformador. Reanudar con otro snapshot o versión exige un run nuevo. El avance se registra después de cada batch confirmado.
- `reconcile` compara source y target por usuario y colección: recuento, conjunto de legacy IDs y digest estable de los campos canónicos. Termina con código distinto de cero si hay diferencias no explicadas, cuarentena sin resolver o una fuente autoritativa ausente.

## Orden de escritura

1. Validar snapshot y mapping Auth → `profiles`.
2. Importar inventario, drafts, favoritos, comidas, preferencias y jobs por `(source, entity_type, legacy_id)`, con UUID target estable en `legacy_id_map`.
3. Importar usage como histórico con periodo y clave idempotente; nunca aumentar dos veces el contador canónico.
4. Reconciliar la suscripción heredada como dato histórico. Stripe sigue siendo la autoridad económica del Sprint 10: un documento Firebase no puede sobrescribir una suscripción Stripe activa ni su cursor.
5. Copiar solo objetos Storage referenciados por filas importadas que deban conservarse. Listar huérfanos sin copiarlos.

El rerun hace upsert sobre el mismo target ID. Un documento fuente modificado actualiza esa fila; un documento inválido o sin UID mapeado entra en cuarentena con código seguro. No se inventa propietario ni se descarta silenciosamente. `recipe_cache` y cachés no autoritativas se excluyen del denominador de reconciliación.

## Reportes y seguridad

El reporte JSON/CSV incluye run ID, snapshot digest, transformador, entorno, recuentos `source/imported/updated/already_present/quarantined/ignored`, digest por usuario y colección y códigos de error. No incluye hashes de contraseña, tokens, claves, URL firmadas ni payload OCR completo. Los reportes con IDs reales se escriben fuera del repositorio y usan permisos locales restringidos. Los tests emplean exclusivamente fixtures sintéticos.

## Pruebas de aceptación propuestas

- Repetir un snapshot completo no cambia cardinalidad ni IDs target; cambiar un documento actualiza la misma fila.
- Un fallo tras un batch permite reanudar sin duplicar filas o contadores.
- Dos documentos con el mismo legacy ID, UID inexistente, referencia rota, documento parcial y payload incompatible quedan contabilizados con resultado determinista.
- Un objeto Storage referenciado se copia una vez; uno huérfano solo aparece en el reporte.
- Reconciliación compara claves y digests, no solo recuentos; las diferencias y cuarentenas causan exit code no cero.
- `capture` solo lee Firestore; `plan` y `dry-run` no escriben en Supabase ni Storage; staging exige confirmación explícita; producción se rechaza.
- Los logs y reportes saneados no contienen secretos ni payloads sensibles.

## Decisiones confirmadas

El origen será la lectura directa del proyecto Firestore `what-s-in-my-fridge-a2a07`. No hay export WatermelonDB y la cobertura se declara parcial. Sigue pendiente la aprobación formal del spec antes de implementar o importar.
