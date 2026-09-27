# Diseño propuesto

## Flujo

Entrada → job/lease → fuentes separadas → evaluar cobertura → subtítulos/ASR cuando haga falta → evidencia con IDs → extracción schema → validar estructura y fidelidad → ready/review_required/fallo → revisión persistida → UI.

Caption no se sobrescribe. Cada fragmento conserva sourceKind e ID/timestamps. La evidencia queda en memoria; en producción se persisten códigos y versiones, no contenido adicional. Los campos finales mantienen `recipe-v1` para lectores históricos; quality y versionado se añaden a provenance. Si fuese imprescindible cambiar el schema final, usar un contrato nuevo con lector dual y migración explícita, nunca romper recipe-v1.

## Contratos

- ASR interno: contrato `transcription-v2`; model/config/language/segments con start/end/text y señales admitidas por versión. `/transcribe` conserva `text` para clientes legacy. Bearer multipart y límites 10 min/20 MiB permanecen.
- Extracción intermedia: schema distinto del público; referencias a fragmentos para nombres, medidas y acciones. Validar que IDs existen y que números/unidades están soportados antes de eliminar evidencia de la salida pública. La presencia de un ID por sí sola no demuestra entailment; reglas deterministas más revisión humana del benchmark.
- Quality: `{version,status:ready|review_required,reasons:string[],pipelineVersion,promptVersion,asrModel,extractionModel}` en provenance, sin puntajes inventados. Códigos: cantidad desconocida, conflicto de fuentes, fragmento incierto, cobertura incompleta. UI da textos españoles comprensibles.
- Edición: ruta autenticada de revisión del job; revisión del usuario separada del original, con CAS/version para evitar sobrescrituras concurrentes. El GET detalle devuelve versión activa autorizada y conserva el original recuperable.
- Reproceso: POST autenticado `/api/recipe-jobs/[jobId]/reprocess`, solo dueño, versión de pipeline definida por servidor, operación idempotente. Nueva tabla de revisiones/operaciones por job (RLS), transacción de lease/enqueue outbox o reconciliación compatible con infraestructura existente. No reutilizar POST de importación que consume cuota. Implementar rate-limit de 3 reprocesos por usuario/hora y un único candidato activo por job.

## Selección de modelos y presupuesto

Comparar base actual con candidato CPU `small` y extracción actual con prompt/schema mejorados; candidato LLM adicional solo si el baseline mejorado no pasa. Son candidatos, no elección automática de despliegue. Registrar versión/digest exactos y parámetros; evaluar sobre recursos reales de Cloud Run. Si ningún candidato pasa calidad/tiempo/memoria, dejar flag apagado y presentar resultados sin reducir silenciosamente los criterios.

## Datos, seguridad y compatibilidad

Migración aditiva: revisiones inmutables del resultado original, candidato y edición activa. Revisión por usuario nunca cambia el catálogo compartido. Acceso por sesión y ownership/RLS; worker privado escribe con rol de servicio, no confiando en user_id del navegador. URL fuente segura y evidencia tratada como texto. Temporales se limpian en finally y TTL de emergencia; producción sin transcripciones en logs. Evaluación aislada sin API de cuota ni escritura del job real.

## Validación y despliegue

Corpus anotado antes de optimizar; runner produce métricas por etapa y diferencia ready/review_required. Unit tests verifican contratos, no calidad del modelo. Calidad exige ejecución real de proveedores y comparación humana contra audio/fuentes. Contract tests garantizan comportamiento con respuestas antiguas. Canary de pocos jobs de prueba; activar flag solo con reporte de gates y aceptación del corpus. Rollback conserva lector compatible, original y versiones aceptadas.

## Riesgos conocidos

Modelos CPU mayores pueden incumplir tiempo/memoria. ASR no cubre ingredientes solo visibles en el vídeo. Fuentes sociales pueden bloquearse. Un verificador LLM también puede equivocarse. Estos casos requieren aviso/revisión; no completar con datos inventados.
