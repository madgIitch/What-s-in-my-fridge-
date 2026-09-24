# sprint-12-firebase-data-migration-and-reconciliation · undefined — Tareas

Checklist de implementación. El agente marca [x] al completar; los gates verifican.

- [ ] (T1) El runner exige environment explícito y rechaza accidentalmente URLs/proyectos de producción salvo flag de cutover separado.  ↔ R1
- [ ] (T2) Cada documento importado conserva legacy path/id o mapping suficiente para rastrearlo.  ↔ R2
- [ ] (T3) Repetir el import completo no cambia cardinalidades salvo registros fuente modificados.  ↔ R3
- [ ] (T4) Los items, favoritos, comidas, drafts, usage y subscription se reconcilian por usuario con counts y claves.  ↔ R4
- [ ] (T5) Los documentos inválidos se contabilizan y quedan en quarantine con motivo; no se omiten silenciosamente.  ↔ R5
- [ ] (T6) recipe_cache y caches no autoritativas no bloquean reconciliación.  ↔ R6
- [ ] (T7) Storage huérfano se reporta y no se migra por defecto.  ↔ R7
- [ ] (T8) Los reports no incluyen password hashes, tokens, URLs firmadas, raw secrets ni payloads completos de OCR salvo modo local explícito.  ↔ R8
- [ ] (T9) Una segunda ejecución después de modificar un documento source actualiza la misma fila target por legacy id.  ↔ R9
- [ ] (T10) Tests con fixtures cubren duplicados, usuario inexistente, referencia rota, documento parcial y reanudación tras fallo.  ↔ R10
- [ ] Tests que cubran los criterios de aceptación
