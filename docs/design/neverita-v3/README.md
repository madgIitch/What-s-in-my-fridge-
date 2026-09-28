# Guía visual Neverita v3

Referencias aportadas para preparar y diseñar los sprints R0–R8 de `spec.json`. Son una guía de jerarquía, tono, navegación, estados e interacciones. El texto, las cifras, las fechas y los ejemplos de productos son ilustrativos; los contratos funcionales y los criterios de aceptación de cada sprint se definen en su spec aprobado.

| Archivo | Pantallas y patrones | Sprints |
| --- | --- | --- |
| [01](01-pantry-edit-and-system-states.png) | Edición de alimento; estados sin conexión, error, deshacer y fallo de ticket | R1, R8 |
| [02](02-pro-and-import-limit.png) | Cuenta Pro, consumo mensual y límite de importaciones | R7, R8 |
| [03](03-weekly-planning.png) | Plan semanal y elección del día para cocinar | R6 |
| [04](04-shopping-list.png) | Compra agrupada por origen y cierre con ticket | R5 |
| [05](05-recipe-import-and-availability.png) | Importación por enlace, texto o archivo; disponibilidad de ingredientes | R3 |
| [06](06-onboarding-and-empty-home.png) | Entrada con ticket o manual; Hoy sin inventario | R1, R2 |
| [07](07-cooking-library.png) | Biblioteca de recetas, sugerencias y guardadas | R3 |
| [08](08-pantry.png) | Despensa por ubicación, incertidumbre y cantidad aproximada | R1 |
| [09](09-cooking-and-reconciliation.png) | Modo cocina y confirmación de consumo en despensa | R4 |
| [10](10-today-decision.png) | Hoy con recomendaciones y motivos para aprovechar o comprar | R2 |

## Patrones compartidos

- Fondo rosa claro, superficies cálidas, tipografía oscura, acentos coral y estados verde/ámbar cuando aportan significado.
- Personajes e ilustraciones kawaii como apoyo contextual; la información y la acción principal deben seguir siendo legibles sin ellos.
- Jerarquía móvil: una decisión principal por pantalla, tarjetas con estados claros y acciones cercanas al contexto.
- Navegación y botón central mostrados en los conceptos: validar su comportamiento al preparar cada sprint. Estas imágenes no aprueban por sí solas ningún cambio de navegación.
- Estados de error, carga, conexión e incertidumbre con una acción de recuperación visible.

Las referencias están enlazadas también desde los sprints correspondientes de `spec.json`. R0 usa el conjunto para fijar contratos de producto y R8 para unificar el sistema visual y sus estados.
