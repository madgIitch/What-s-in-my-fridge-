# Comparación visual R1 en localhost

Capturas tomadas el 1 de octubre de 2026 contra Supabase local y `PRODUCT_V3=true`, desde Playwright Chromium. Son datos creados por el flujo real barcode desconocido → review → confirmación; no son una maqueta.

| Captura | Ancho | Evidencia |
| --- | ---: | --- |
| [Añadir compra](r1-add-purchase-320.png) | 320 px | Ticket como acción primaria; barcode, voz y manual secundarios; navegación móvil. |
| [Review](r1-review-390.png) | 390 px | Línea desconocida, fecha civil/copy de fallback y confirmación explícita. |
| [Despensa](r1-pantry-320.png) | 320 px | Buscador, banner del último ticket, agrupación «Por ubicar», estado y CTA de compra. |
| [Editor](r1-editor-390.png) | 390 px | Nombre, ubicación, concepto, estado cualitativo, fecha opcional, nota, guardar y tombstone. |

Frente a 01/06/08 se conserva la jerarquía cálida crema/rosa/ciruela, CTA coral, navegación inferior y lectura antes que decoración. R1 añade ámbar únicamente para incertidumbre/pending. Las pruebas verifican ausencia de overflow horizontal a 320 px; en el hub comprueban objetivos de al menos 44 px, navegación con teclado, foco restaurado al cerrar con Escape y `prefers-reduced-motion` sin animación. El resto de superficies se inspeccionó en capturas/CSS; queda la revisión humana móvil completa.
