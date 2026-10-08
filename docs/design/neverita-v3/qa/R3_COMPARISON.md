# R3 · verificación visual y funcional

8 de octubre de 2026. Capturas de localhost con cuentas y fixtures sintéticos en
Supabase local. Biblioteca, disponibilidad, favoritos y compra usan respuestas
reales de API y DB.

## Comparación con referencias 05 y 07

Se mantienen el fondo rosa, superficies crema, texto ciruela, acciones coral,
navegación inferior y listas agrupadas. Cocinar ofrece Para hoy, Guardadas e
Importadas. El resultado prioriza «Tienes 2 de 4», la comparación provisional y
las cantidades sin evidencia. La preparación aparece una sola vez, después de
las acciones. A 320 y 393 px no hay desbordamiento horizontal.

Las referencias incluyen fotografías que los datos no garantizan; el spec
aprobado prohíbe inventarlas. No se fabrican tiempos, cantidades ni suficiencia.
La navegación fija y el indicador de desarrollo visibles en las capturas son
parte del viewport de localhost, no una composición de producción.

| Estado | 320 px | 393 px |
| --- | --- | --- |
| Biblioteca Para hoy | [Biblioteca](r3-library-320.png) | [Biblioteca](r3-library-393.png) |
| Importación provisional 2/4 | [Resultado](r3-result-320.png) | [Resultado](r3-result-393.png) |
| Colección importada | — | [Importadas](r3-imported-393.png) |
| Snapshot guardado | [Guardada](r3-saved-320.png) | — |

Se comprobaron objetivos táctiles de 44 px, foco inicial y restauración del
modal, Escape y movimiento reducido. Las etiquetas largas se ajustan sin
ocultar la incertidumbre. Los estados de carga, error, offline y sesión caducada
se distinguen; offline conserva únicamente el resultado anterior del usuario.

## Evidencia y límites

Playwright mobile-chrome: cuatro recorridos v3 pasan; rollback se omite en esa
ejecución y pasa por separado con PRODUCT_V3=false. Se prueban compra confirmada,
conflicto por cambio de despensa, guardado sin duplicados, recarga, recuperación
de fallo, retry del mismo job sin cuota adicional y aislamiento entre cuentas.

Enlace y texto crean jobs en la API actual. Archivo usa la API real de creación
con autorización y transferencia GCS simuladas; el procesamiento externo se
simula completando el job en DB local. Estas pruebas no acreditan Whisper,
extracción multimedia, fidelidad de receta ni subida real a GCS.

El corpus humano de 12 casos (split 8/4), veinte ejecuciones warm, métricas y
umbrales del spec de calidad, WebKit/Firefox y smoke real URL/Whisper/GCS siguen
pendientes y bloquean activación general. No se ha desplegado ni aplicado SQL
remoto. Los fixtures SQL hacen rollback; las cuentas de navegador quedan
únicamente en el entorno local. No se realizó ningún reset.
