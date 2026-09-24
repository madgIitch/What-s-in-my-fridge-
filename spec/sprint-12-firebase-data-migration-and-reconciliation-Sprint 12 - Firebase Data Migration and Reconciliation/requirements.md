# sprint-12-firebase-data-migration-and-reconciliation · undefined — Requisitos

- name: `Sprint 12 - Firebase Data Migration and Reconciliation` · priority: P0 · sdd: true
- aprobado por: peorr · 2026-09-24T15:57:01.257Z

## Contexto



## Requisitos funcionales

R1. El runner exige environment explícito y rechaza accidentalmente URLs/proyectos de producción salvo flag de cutover separado.
R2. Cada documento importado conserva legacy path/id o mapping suficiente para rastrearlo.
R3. Repetir el import completo no cambia cardinalidades salvo registros fuente modificados.
R4. Los items, favoritos, comidas, drafts, usage y subscription se reconcilian por usuario con counts y claves.
R5. Los documentos inválidos se contabilizan y quedan en quarantine con motivo; no se omiten silenciosamente.
R6. recipe_cache y caches no autoritativas no bloquean reconciliación.
R7. Storage huérfano se reporta y no se migra por defecto.
R8. Los reports no incluyen password hashes, tokens, URLs firmadas, raw secrets ni payloads completos de OCR salvo modo local explícito.
R9. Una segunda ejecución después de modificar un documento source actualiza la misma fila target por legacy id.
R10. Tests con fixtures cubren duplicados, usuario inexistente, referencia rota, documento parcial y reanudación tras fallo.

## Restricciones

- **error_states:** Cuarentena con códigos seguros para documento inválido, UID ausente y referencias rotas; reconciliación falla con diferencias no explicadas.
- **auth_secrets:** Lectura Firestore con credenciales de solo lectura; reportes saneados fuera del repo; destino staging requiere confirmación explícita.
- **rollback_compat:** Import idempotente y aditivo por legacy ID; producción fuera de alcance; Stripe conserva autoridad económica.

