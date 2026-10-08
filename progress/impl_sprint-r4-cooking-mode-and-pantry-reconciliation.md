# R4 · implementación

8 de octubre de 2026. Spec aprobado explícitamente antes de implementar;
31 criterios, ocho dimensiones y scope vigente. Implementación manual.

Modo cocina para catálogo, import vigente y favorito inmutable, con pasos,
progreso persistente, preview, ajuste y confirmación. El motor comparte
resolución de conceptos y cantidades conservadoras de R2/R3; duplica cero lotes,
ordena FEFO solo con fecha exacta verificable y usa aritmética decimal.
Unknown no resta automáticamente; ajustes manuales registran user_adjustment.

Plan privado de hasta 60 minutos, confirmación y undo compensatorio dentro de
transacciones. Replay precede validación de estado nuevo. Cambios posteriores
de receta/despensa invalidan la confirmación; una edición posterior de cualquier
lote afectado bloquea undo completo, incluso si el valor vuelve a ser igual.
Ventana de undo cinco minutos, evento único y auditoría preservada.

IndexedDB usa la DB privada reservada neverita-pwa-v1 (versión1, store drafts),
ya incluida en la limpieza global de sesión. Antes de R4 ningún módulo creaba
esta DB. No se modifica el schema ni outbox de inventario/favoritos. Draft e
intención se aíslan por usuario/fuente/revisión. Offline no aplica pantry local;
reenviar conserva payload/ID y un conflicto exige preview y consentimiento nuevos.

Migración 20261008000200 aditiva aplicada solo en local; tipos regenerados.
Inventario exacto actualiza también las columnas legacy con cantidad demostrada;
elección cualitativa conserva valores legacy históricos sin elevar precisión.
Undo restaura únicamente los campos de stock y mantiene el resto de metadatos.

Pruebas: web 183 en 47 archivos; dominio 53 en siete archivos y typecheck;
pgTAP 332 en 15 archivos; DB lint; build; cinco controles de concurrencia;
Playwright cinco recorridos v3 y rollback separado. Evidencia visual real
320/393 en docs/design/neverita-v3/qa/R4_COMPARISON.md.

La revisión React sigue la skill vercel:react-best-practices: datos en servidor,
cliente solo para interacción/persistencia, hooks estables, cancelación de
respuestas, controles etiquetados y foco. Se corrigieron acknowledgment obsoleto
tras conflicto y selección prematura durante carga. Sin dependencias nuevas ni
lockfile modificado; worker/Python no afectados. No reset, push, SQL remoto ni
despliegue. Carryover humano de calidad/Whisper/GCS no se declara verificado.
