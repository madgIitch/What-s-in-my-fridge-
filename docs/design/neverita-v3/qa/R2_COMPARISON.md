# R2 · verificación visual y funcional

Fecha: 2 de octubre de 2026. Capturas de localhost con sesiones reales y fixtures
sintéticos en Supabase local. Las capturas de este informe usan respuestas reales
de la API; la prueba adicional de todos los textos con respuestas interceptadas no
se utiliza como evidencia visual.

## Comparación con las referencias 06 y 10

Se conservan rosa claro, crema, ciruela y coral, navegación inferior y acciones
grandes. «¿Qué cenamos?» precede a las decisiones. Las tarjetas separan suficiencia,
cantidades pendientes y faltantes. La primera propuesta y «Cocinar esto» están
visibles antes de las alternativas a 393 × 852. A 320 px no hay desbordamiento
horizontal y las acciones se apilan.

Las referencias conceptuales muestran fotos, mascota y duración de preparación.
R2 no introduce esos datos: el catálogo no garantiza imágenes ni tiempos. El
copy de conservación distingue fecha verificada de estimación. Las recetas
importadas privadas y la cocina guiada siguen en sus specs posteriores.

| Estado real | Captura |
| --- | --- |
| Decisiones y alternativa de aprovechamiento, 393 px | [Hoy](r2-today-393.png) |
| Cantidades por comprobar y compra, 320 px | [Incertidumbre](r2-uncertainty-320.png) |
| Cuenta nueva, 320 px | [Onboarding](r2-onboarding-320.png) |
| Despensa vacía, 393 px | [Vacía](r2-empty-393.png) |
| Despensa migrada sin resolver, 393 px | [Revisión](r2-unresolved-393.png) |
| Ingrediente desconocido, 393 px | [Unknown](r2-unknown-393.png) |
| Catálogo sin candidatos elegibles, 320 px | [Sin candidatos](r2-no-candidates-320.png) |

Las capturas completas contienen la barra fija en la posición del viewport y el
indicador de desarrollo de Next; no son imágenes de producción. Se comprobaron
el tamaño táctil del primer CTA, su posición, foco del modal, Enter/Shift+Tab/Escape,
movimiento reducido, aislamiento del ejemplo y navegación al detalle real.

## Evidencia automatizada

- Playwright `r2-today`, mobile-chrome, PRODUCT_V3=true: 4 casos pasan; el caso
  flag false se omite en esa ejecución y pasa en una ejecución separada.
- Recorrido real: compra confirmada, seis cambios/reaperturas con ambas cuotas
  legacy agotadas, caché estable, offline/reconexión y TTMD sin campos privados.
- Estados vacía, migrada, unknown y sin candidatos calculados por DB/API; error
  503 interceptado seguido de reintento contra la API real.
- SQL: aislamiento de dos cuentas, privilegios, replay antes de validar un
  snapshot nuevo, rechazo de snapshot ajeno/desactualizado y compra atómica.
- `tests/r2-snapshot-locks.mjs`: las escrituras concurrentes de despensa, recetas
  y catálogo esperan; los bloqueos se liberan al finalizar la transacción.

## Benchmark y límites

`supabase/tests/016_today_candidates_benchmark.test.sql` crea 10.002 recetas y
10.001 ingredientes dentro de una transacción que revierte. Retorna 200
candidatos; la ejecución local registrada tarda 1.172,62 ms. Es evidencia de
cardinalidad acotada, no una promesa de latencia en producción.

La protección del snapshot usa bloqueos de tablas y serializa brevemente las
operaciones de caché. El hash incluye el catálogo activo completo dentro de DB;
el servidor recibe ingredientes completos solo de los candidatos. Esta estrategia
prioriza consistencia y requerirá medir contención con tráfico real antes de
optimizarla. R2 no descarga ni puntúa todo el catálogo en el navegador.

No se aplicaron cambios remotos ni se desplegó R2. Una recarga offline mantiene
el fallback PWA existente. El smoke de R1 con ticket/cámara/voz reales sigue
pendiente y no queda acreditado por estas pruebas.
