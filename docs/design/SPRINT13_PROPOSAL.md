# Sprint 13 — propuesta de paridad PWA, responsive y accesibilidad

Estado: **review_pending**. Spec aprobado por el usuario el 25 de septiembre de 2026; implementación y verificación local completadas para revisión.

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
| Settings | `/app/settings` | Hub de navegación y cuenta implementado; ajustes funcionales pendientes |
| Import | `/app/recipes/import` | Existe |
| ShoppingList | `/app/shopping-list` | Existe |
| Paywall | `/app/pro` | Existe |
| ConsumeIngredients | Acción accesible desde inventario/detalle, con confirmación | Falta |

### Inventario de rutas del `AppNavigator` legado

El navegador legado declara 19 nombres de pantalla: 1 de acceso, 6 pestañas y 12 pantallas de pila. Su documentación anterior hablaba de 20; el recuento del código fuente actual es 19.

| Pantalla legado | Equivalente PWA | Comportamiento |
| --- | --- | --- |
| Login | `/login` | Acceso y retorno al enlace privado original |
| HomeTab | `/app` | Inventario y sincronización |
| ScanTab | `/app/scan` | Captura o archivo |
| RecipesTab | `/app/recipes` | Sugerencias y catálogo |
| CalendarTab | `/app/calendar` | Mes y comidas |
| SettingsTab | `/app/settings` | Cuenta y accesos; mantenimiento Firebase legado no se traslada |
| FavoritesTab | `/app/favorites` | Recetas guardadas |
| RecipeSteps | `/app/recipes/[id]` | Ingredientes y pasos con enlace estable |
| ReviewDraft | Panel de revisión de `/app/scan` | Edición de líneas antes de confirmar |
| Detail | `/app/items/[id]` | Detalle, edición, eliminación y consumo |
| AddItem | `/app/items/new` | Alta con soporte offline |
| Crop | Panel de recorte de `/app/scan` | Controles con teclado, Escape y retorno de foco |
| ConsumeIngredients | Confirmación en `/app/items/[id]` | Descuento de cantidad con outbox |
| ConsumeRecipeIngredients | Acción «Cocinar» de `/app/favorites` | Plan de ingredientes y commit de consumo |
| AddMeal | `/app/calendar/new` | Enlace profundo al editor |
| MealDetail | `/app/calendar/[id]` | Enlace profundo al editor de comida |
| AddRecipeFromUrl | `/app/recipes/import` | URL, texto o archivo |
| ShoppingList | `/app/shopping-list` | Compra derivada y explícita |
| Paywall | `/app/pro` | Plan, estados y acceso a pagos |

Los paneles de recorte y revisión forman parte de un borrador temporal iniciado en `/app/scan`; sus controles tienen salida explícita. Los equivalentes pueden usar paneles en desktop y páginas completas en móvil.

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

- Nombre y referencia visual definitiva: se mantiene “Neverita”, la identidad actual de la PWA, según el inicio aprobado del sprint.
- La paridad se considera completada cuando la matriz y los flujos sean navegables y verificados. El cierre administrativo del Sprint 12 no prueba la migración de datos; las pruebas de UI del Sprint 13 usarán datos sintéticos y no darán por validado un import de producción.

## Evidencia de implementación local

- Inventario explícito de los 19 nombres de pantalla del `AppNavigator` legado, con URL o panel equivalente.
- Playwright conecta la carpeta E2E del paquete web y la suite histórica de la raíz. El recorrido `auth → inventory → scan mock → review → recipes → favorite → calendar → paywall` pasa con Supabase local y datos sintéticos.
- La auditoría `@axe-core/playwright` no detecta infracciones `critical` ni `serious` en login y 11 rutas privadas. Mide botones y navegación principal de al menos 44 × 44 px.
- Login y las 11 rutas privadas auditadas no presentan overflow horizontal a 320, 375, 430, 768, 1024 y 1440 px en Chromium. El recorte, la edición de comida y las confirmaciones de inventario admiten Escape y retorno de foco.
- La pasada móvil completa de 30 pruebas E2E, `pnpm test` (116 casos), lint, typecheck y build se ejecutaron localmente. La comprobación visual manual en hardware móvil y con lector de pantalla queda para revisión de aceptación.
