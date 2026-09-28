# ADR: Neverita v3, decisiones desde la despensa

Estado: aprobado para Sprint R0 (28 de septiembre de 2026).

## Tesis

Neverita ayuda a decidir qué cocinar hoy a partir de lo que la persona sabe que tiene. Una compra alimenta la despensa; la despensa alimenta recomendaciones y disponibilidad de recetas; cocinar actualiza existencias y faltantes; la compra siguiente cierra el ciclo. La primera pantalla será **Hoy** y ofrecerá decisiones concretas con motivos comprensibles.

## Semántica del producto

- `food_concept` representa un alimento culinario, como huevos. `commercial_product` representa un artículo vendido, como una caja concreta de huevos. Ninguno es por sí mismo una cantidad disponible.
- Un item de despensa representa conocimiento del hogar. Presencia, estado cualitativo, cantidad exacta y frescura tienen precisión y procedencia independientes.
- Fecha de compra, conservación estimada y caducidad exacta son hechos distintos. La fecha legacy `expiry_date` se conserva para compatibilidad, pero no se presenta como exacta sin procedencia fiable.
- Una cantidad desconocida permite decir «lo tienes»; no permite afirmar «tienes suficiente». Una receta distingue suficiente, presente con cantidad sin comprobar, faltante y desconocido.
- Las sugerencias de Hoy usan reglas deterministas y motivos semánticos. Los porcentajes internos no son el mensaje principal al usuario.

## Navegación

La shell v3 móvil muestra **Hoy**, **Despensa**, **+**, **Cocinar** y **Compra**. `+` abre entradas de compra y alta. Favoritos e importaciones viven dentro de Cocinar; el calendario legacy conserva un acceso profundo compatible hasta que la planificación semanal tenga spec aprobado. Las rutas existentes conservan parámetros seguros de enlace profundo durante la transición.

### Dirección visual de la shell R0

- **Tesis visual:** rosa cálido y crema como superficies de trabajo, texto ciruela y una sola acción coral destacada; la menta indica estado útil.
- **Plan de contenido:** encabezado breve para orientación, área central de trabajo, navegación de cinco destinos siempre reconocible.
- **Interacción:** elevación breve del destino al enfocar, entrada discreta del contenido y respuesta clara del botón central; todo se desactiva con movimiento reducido.

## Compatibilidad y activación

`PRODUCT_V3` activa la nueva shell para un canary. Con la flag apagada, siguen disponibles las rutas y contratos v2. Las tablas y columnas nuevas son aditivas; no se reinterpreta el valor legacy como evidencia nueva. R1–R8 implementan sus flujos únicamente tras aprobar sus specs.

## Consecuencias

El dominio debe modelar explícitamente lo desconocido. El OCR, catálogos y matching pueden proponer conocimiento, pero no elevar su precisión sin evidencia o confirmación. Las operaciones de inventario existentes siguen usando sus contratos hasta una migración aprobada.
