# Auditoría de calidad de recetas importadas

## Evidencia y límites

Caso observado: job `ffb0d947-1da6-447b-b4c0-229937a89627`, Instagram, consultado en modo lectura. Estado `completed`, `recipe-v1`, cuatro ingredientes, cinco pasos, recorrido `social-metadata → whisper`, `transcriptRetained:false`. La captura del usuario contiene cantidades como «Por casa» y pasos como «Cortad la ensalada» o «Parecéis que estáis a punto de prohibir algo».

Se verificaron el resultado persistido y todo el recorrido de código; no se volvió a ejecutar el job ni se modificó su resultado. No hay transcripción histórica para comparar palabra a palabra con el audio. No se ha escuchado/anotado el reel en esta auditoría: atribuir cada frase al ASR o al LLM todavía sería una hipótesis. La primera tarea de implementación es reproducirlo de forma aislada y comparar etapas contra una referencia humana.

## Recorrido comprobado

| Etapa | Implementación actual | Problema de calidad |
| --- | --- | --- |
| Entrada PWA | `recipe-import.tsx`, POST `/api/recipe-jobs`, create-job/RPC, Cloud Tasks | El usuario ve progreso y resultado, pero no incertidumbre del contenido. |
| Fuente social | `pipeline.ts/socialMetadata`: yt-dlp title + description | No recupera subtitles; no separa receta, hashtags y promoción. |
| Elección de fuente | `contracts.ts/sufficientText`: 120 caracteres y 20 palabras | Longitud no demuestra que existan ingredientes/instrucciones; caption largo irrelevante puede saltarse audio. |
| Audio | yt-dlp, ffprobe, ffmpeg mono 16 kHz MP3 48 kbps | Transformación con pérdida; su impacto no está medido. |
| ASR | `whisper_api.py`: modelo `base`, CPU int8, beam 5, VAD | Worker no envía idioma; servicio devuelve texto/idioma/segmentos pero no indicadores de incertidumbre. El modelo está fijado también en Docker. |
| Fusión | Worker reemplaza `text` con Whisper | Descarta el caption en vez de combinar evidencia complementaria. |
| Extracción | `providers.ts`: qwen2.5:3b por defecto, `/api/generate`, `format:"json"` | Prompt genérico; no instruye sobre cantidades desconocidas, bromas, contradicciones, evidencia por campo ni pasos culinarios. Sin temperatura explícita ni schema como formato. |
| Validación | `validateRecipe`: cadenas/arrays no vacíos | No verifica cantidades/unidades ni fundamentación. Un JSON legible puede ser una receta mala. Repair solo se dispara por forma inválida. |
| Persistencia | RPC complete, provenance con extractionPath | No registra versión/modelo/configuración ni razones de revisión; estado completed se interpreta como calidad correcta. |
| Presentación | detalle importado, concatenación amount/unit/name | Renderiza literalmente redundancias; no muestra fuente ni avisos de cantidades no indicadas. |

## Distinción necesaria

- Confirmado: pérdida de caption, descarte de metadatos ASR, validación superficial y ausencia de evaluación de fidelidad.
- Por medir: contribución del modelo ASR, música, compresión, idioma detectado y modelo LLM al fallo concreto.
- No basta con cambiar un modelo o mejorar la gramática: hay que medir ingredientes, cantidades y operaciones contra el contenido fuente.

## Referencias primarias consultadas

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper): configuración de modelos, VAD y segmentos. Verificar disponibilidad de opciones en la versión instalada antes de usarlas.
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs): schema JSON y configuración de generación; el esquema restringe forma, no prueba fidelidad.
