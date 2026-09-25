# Sprint 13 — propuesta de paridad PWA, responsive y accesibilidad

Estado: **borrador para aprobación**. En `spec.json`, `spec_approved` sigue en `false`; no se implementarán cambios visuales hasta aprobar este spec.

## Diagnóstico de partida

El cliente legado declara 20 pantallas en `AppNavigator`. La PWA tiene rutas explícitas para acceso, inventario, scan/revisión, recetas, importación, favoritos, compra, calendario y Pro. Faltan equivalentes navegables o sustitutos documentados para ajustes, detalle de inventario, pasos de receta, recorte manual, consumo de ingredientes, detalle de comida y varios flujos de edición. Las rutas existentes usan barras de navegación distintas y algunas acciones están anidadas en componentes sin URL propia.

## Dirección visual

- **Tesis visual:** conservar provisionalmente “Neverita”, identidad actual de la PWA, con superficie cálida, verde profundo, tipografía legible y una jerarquía calmada que priorice el trabajo del usuario. Si el usuario elige “Neverito”, se ajustará el spec antes de implementarlo.
- **Plan de contenido:** cada pantalla abre en su tarea primaria; contexto secundario y estados aparecen debajo o al lado según el ancho. En desktop se amplía el área de trabajo y se muestra contexto lateral cuando ayuda, sin cambiar el recorrido.
- **Interacción:** transiciones breves de panel/editor y cambio de estado de navegación; indicación visible de sincronización. Todas se desactivan con `prefers-reduced-motion`.

## Matriz de paridad propuesta

| Pantalla legado | Ruta o sustituto PWA | Estado inicial |
| --- | --- | --- |
| Home, AddItem, Detail | `/app`, editor y detalle accesibles desde inventario; URLs `/app/items/new` y `/app/items/[id]` para deep links | Parcial |
| Scan, Crop, ReviewDraft | `/app/scan`; recorte y revisión dentro del flujo, con foco y salida explícita | Parcial |
| Recipes, RecipeSteps, ConsumeRecipeIngredients | `/app/recipes`, `/app/recipes/[id]`, confirmación de consumo | Parcial |
| Favorites | `/app/favorites` | Existe |
| Calendar, AddMeal, MealDetail | `/app/calendar`, `/app/calendar/new`, `/app/calendar/[id]` | Parcial |
| Settings | `/app/settings` | Falta |
| Import | `/app/recipes/import` | Existe |
| ShoppingList | `/app/shopping-list` | Existe |
| Paywall | `/app/pro` | Existe |
| ConsumeIngredients | Acción accesible desde inventario/detalle, con confirmación | Falta |

La matriz final se completará con cada pantalla legada del scope; ningún flujo queda implícitamente descartado. Los equivalentes pueden usar paneles en desktop y páginas completas en móvil, pero conservan URL y semántica estables.

## Contratos de navegación y accesibilidad

- Una navegación primaria consistente en `/app`: inventario, escanear, recetas, calendario y un menú para favoritos, compra, ajustes y Pro. En móvil se mantiene la navegación inferior con cinco destinos; en tablet/desktop usa una barra lateral o superior con las mismas rutas. El estado activo se indica con `aria-current="page"` y texto, no solo color.
- La protección de rutas guarda `returnTo` solo para paths locales `/app/**` allowlisted, conserva query/hash seguros y retorna a la ruta tras login. Los links directos a detalles deben resolver o mostrar un estado de no encontrado útil.
- Target principal mínimo de 44×44 CSS px; teclado completo, `:focus-visible`, labels asociados, orden de foco lógico, Escape/cancelar en diálogos, foco inicial y retorno al disparador. Los avisos asincrónicos usan regiones `status`/`alert` apropiadas.
- Loading, vacío, offline, error, pendiente y conflicto tienen texto, iconografía y acciones distinguibles. Los formularios nunca confirman una escritura offline antes del commit autoritativo.
- A 320, 375, 430, 768, 1024 y 1440 px no hay overflow horizontal involuntario; probar también zoom al 200% y texto largo.

## Verificación

- Inventario de las 20 pantallas legado con ruta, sustituto o excepción aprobada.
- Playwright en los seis anchos, teclado y deep links, con una prueba de flujo `auth → inventory → scan mock → review → recipes → favorite → calendar → paywall` usando fixtures aislados.
- `axe-core`/Playwright sobre rutas y estados críticos sin infracciones `critical` o `serious`; comprobar manualmente foco, lectura de estados y movimiento reducido donde la automatización no capture el comportamiento.
- Tests de contrato para `returnTo` y navegación. No se incluye una prueba que solo replique clases CSS.

## Decisiones abiertas

- Nombre y referencia visual definitiva: se propone “Neverita”, pendiente de la respuesta del usuario.
- La paridad se considera completada cuando la matriz y los flujos sean navegables y verificados. El cierre administrativo del Sprint 12 no prueba la migración de datos; las pruebas de UI del Sprint 13 usarán datos sintéticos y no darán por validado un import de producción.
