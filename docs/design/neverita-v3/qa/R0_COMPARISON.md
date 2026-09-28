# Comparación visual R0 en localhost

Fecha: 28 de septiembre de 2026. Servidor Next local con `PRODUCT_V3=true`, Supabase local y cuenta sintética de pruebas.

Referencias inspeccionadas: `10-today-decision.png` y `08-pantry.png`.

## Ajustes de la shell

- Fondo rosa y superficies crema, tipografía ciruela con título de peso alto.
- Cinco destinos aprobados: Hoy, Despensa, +, Cocinar y Compra. La referencia llama Recetas al cuarto destino; el spec aprobado establece Cocinar.
- Iconos lineales de casa, nevera, cocina y compra; botón coral circular elevado e indicador coral en destino activo.
- Interacción del botón central con ticket/manual y Escape con retorno de foco. Respeta movimiento reducido.

Captura real: `r0-pantry-localhost.png`. La captura corresponde al ancho del panel del navegador; el smoke Playwright verifica también 320 px sin overflow.

## Diferencias pendientes por sprint

R0 entrega shell y contratos. Los grupos Nevera/Armario/Congelador, buscador y pendientes de ticket pertenecen a R1. Las tarjetas con receta, motivos y acciones de Hoy pertenecen a R2. Biblioteca unificada e importadas pertenecen a R3. No se incluyen datos de ejemplo ni estados de suficiencia inventados para simular esas pantallas.
