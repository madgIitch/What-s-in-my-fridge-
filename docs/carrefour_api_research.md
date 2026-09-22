# Carrefour API / APK Research Notes

## Proyecto
**What's in my fridge??**

Documento técnico con los hallazgos obtenidos al analizar la APK de **Mi Carrefour** decompilada.

Objetivo: identificar endpoints, modelos, flujos y estructuras útiles para integrar catálogo de productos, búsquedas por nombre, códigos EAN, ingredientes, nutrición y categorización dentro de la PWA.

---

# 1. APK analizada

Aplicación:

```text
Mi Carrefour
package: com.munrodev.crfmobile
```

Durante el análisis aparecen principalmente:

```text
com.munrodev.crfmobile
com.mic4.core
```

La APK contiene:

- clientes HTTP propios;
- Retrofit / OkHttp;
- modelos ecommerce;
- endpoints de búsqueda;
- detalle de producto;
- lector EAN;
- estructura de categorías;
- modelos de nutrición e ingredientes.

---

# 2. Arquitectura de datos detectada

Carrefour parece utilizar varias APIs diferentes según el caso de uso.

Las dos rutas más interesantes para nuestro proyecto son:

```text
1. Search API
   ↓
   búsqueda y descubrimiento masivo de productos

2. Product / EAN APIs
   ↓
   detalle del producto, ingredientes y nutrición
```

Flujo recomendado:

```text
Texto / nombre
    ↓
search-api
    ↓
product_id / EAN
    ↓
pdp-food
    ↓
detalle alimentario
```

Para escaneo:

```text
EAN
  ↓
getProductByEAN
  ↓
producto + precio + información alimentaria
```

---

# 3. API de búsqueda de productos

## Base URL

```text
https://www.carrefour.es/search-api/
```

## Endpoint

```http
GET /query/v1/search
```

URL completa:

```text
https://www.carrefour.es/search-api/query/v1/search
```

---

# 4. Parámetros del buscador

La APK utiliza parámetros similares a:

| Parámetro | Uso |
|---|---|
| `query` | texto buscado |
| `scope` | entorno de búsqueda |
| `lang` | idioma |
| `rows` | número de resultados |
| `start` | offset / paginación |
| `sort` | orden opcional |
| `filter` | filtros opcionales |
| `f.op` | operador de filtros |

Valores observados:

```text
scope=app
lang=es
rows=24
start=0
f.op=OR
```

Ejemplo:

```http
GET https://www.carrefour.es/search-api/query/v1/search?query=leche&scope=app&lang=es&rows=24&start=0&f.op=OR
```

---

# 5. Headers observados

El cliente de búsqueda utiliza al menos:

```http
User-Agent: MiCarrefour3.0 DeviceId: <deviceId>
Accept: */*
```

Ejemplo de prueba:

```bash
curl "https://www.carrefour.es/search-api/query/v1/search?query=leche&scope=app&lang=es&rows=24&start=0&f.op=OR" \
  -H "User-Agent: MiCarrefour3.0 DeviceId: test" \
  -H "Accept: */*"
```

PowerShell:

```powershell
curl.exe "https://www.carrefour.es/search-api/query/v1/search?query=leche&scope=app&lang=es&rows=24&start=0&f.op=OR" `
  -H "User-Agent: MiCarrefour3.0 DeviceId: test" `
  -H "Accept: */*"
```

---

# 6. Modelo de producto encontrado

La APK contiene modelos equivalentes a `ProductItem`.

Campos detectados:

```text
product_id
sku_id
catalog_ref_id

ean
ean13

display_name
name
brand
description

image_path
images
alternative_images

active_price
app_price
price_per_unit
price_per_unit_text
strikethrough_price

stock
units_in_stock

offer_id
best_offer_id
promotions
promos

measure_unit
variable_weight
sell_pack_unit

catalog
document_type
```

---

# 7. Datos útiles para What's in my fridge??

Del Search API podemos potencialmente obtener:

```text
nombre
marca
EAN
EAN13
precio
precio por unidad
imagen
stock
promociones
tipo de medida
peso variable
pack de venta
product_id
sku_id
```

Esto lo convierte en una buena fuente para:

- autocompletado;
- búsqueda manual;
- reconocimiento de productos;
- selección tras OCR;
- enriquecimiento de tickets;
- construcción inicial del catálogo.

---

# 8. API de detalle de producto alimentario

## Endpoint

```http
GET https://www.carrefour.es/cloud-api/pdp-food/v1/
```

Parámetro:

```text
product_id
```

Ejemplo conceptual:

```http
GET https://www.carrefour.es/cloud-api/pdp-food/v1/?product_id=<PRODUCT_ID>
```

---

# 9. Modelo de detalle

La respuesta se mapea a una estructura similar a:

```text
EcommerceDetailsResponse
└── product
```

El modelo `Product` contiene campos como:

```text
product_id
name
description
brand
images
sku_id

nutrition_info
nutritional_value
nutri_score

origin
danger_icons
info_tags
details
more_info

offer
promotions

measure_unit
sell_pack_unit
variable_weight
```

---

# 10. Ingredientes

La APK contempla:

```text
nutrition_info.ingredientes
```

Este campo es especialmente útil para:

- detectar ingredientes;
- clasificar alimentos;
- alergias;
- matching de recetas;
- normalización del inventario;
- generación asistida de recetas.

---

# 11. Información nutricional

También aparece:

```text
nutritional_value.main_nutritional_values
nutritional_value.other_nutritional_values
```

Además:

```text
nutri_score
```

Esto permite potencialmente almacenar:

```text
energía
grasas
grasas saturadas
hidratos
azúcares
proteínas
sal
fibra
otros valores
nutri-score
```

---

# 12. API de lectura por EAN

La app dispone de una funcionalidad específica para productos escaneados.

Endpoint:

```http
GET https://pro.api.carrefour.es/md-transactionMalls-v1/anonymous/Mall/getProductByEAN
```

Parámetros detectados:

```text
clientId
mallId
eanCode
```

Ejemplo conceptual:

```http
GET /md-transactionMalls-v1/anonymous/Mall/getProductByEAN
    ?clientId=<CLIENT_ID>
    &mallId=<MALL_ID>
    &eanCode=<EAN>
```

---

# 13. Modelo ProductScannedResponse

La APK espera una respuesta parecida a:

```json
{
  "eanProduct": "...",
  "shortDescription": "...",
  "longDescription": "...",
  "price": "...",
  "urlImage": "...",
  "promotion": "...",
  "mallId": "...",
  "page": "...",
  "infoAlimentaria": {}
}
```

---

# 14. Información alimentaria del producto escaneado

Dentro de:

```text
infoAlimentaria
```

aparecen campos como:

```text
ingredientes
alergenos
valorMedioPor
valorEnergetico
listInfoNutrientes
otros
masInfo
masInfoInforme
```

Ejemplo orientativo:

```json
{
  "eanProduct": "841...",
  "shortDescription": "Leche semidesnatada...",
  "longDescription": "...",
  "price": "1,05 €",
  "urlImage": "...",
  "infoAlimentaria": {
    "ingredientes": "Leche semidesnatada de vaca...",
    "alergenos": {},
    "valorMedioPor": "100 ml",
    "valorEnergetico": {},
    "listInfoNutrientes": [],
    "otros": [],
    "masInfo": [],
    "masInfoInforme": []
  }
}
```

---

# 15. Importancia del endpoint EAN

Desde el punto de vista de **What's in my fridge??**, este endpoint es especialmente interesante porque encaja directamente con:

```text
cámara
  ↓
lectura EAN
  ↓
consulta Carrefour
  ↓
producto
  ↓
inventario
```

Datos potencialmente recuperables:

```text
EAN
nombre corto
nombre largo
precio
imagen
promoción
ingredientes
alérgenos
nutrición
información adicional
```

---

# 16. API de categorías

La APK también utiliza un endpoint de menú / categorías:

```http
GET https://www.carrefour.es/api/unified_menu/{salePoint}/json
```

También aparece soporte para locale / idioma.

Flujo potencial:

```text
unified_menu
   ↓
categorías
   ↓
subcategorías
   ↓
búsqueda
   ↓
productos
```

Esto podría utilizarse para realizar crawling controlado del catálogo.

---

# 17. APIs de sugerencias

La Search API incluye endpoints relacionados con sugerencias.

Detectados:

```http
GET /suggestions/v1/empathize
GET /suggestions/v1/nextqueries
GET /suggestions/v1/relatedtags
```

Potenciales usos:

- autocomplete;
- términos relacionados;
- mejora de la búsqueda;
- corrección de nombres de producto;
- sugerencias tras OCR.

---

# 18. Estrategia de integración recomendada

## Nivel 1 — Search API

Usar como fuente primaria:

```text
search-api/query/v1/search
```

Ventajas:

- sencilla;
- buena para búsqueda de texto;
- devuelve gran cantidad de metadata;
- incluye EAN;
- útil para poblar catálogo;
- útil para búsqueda tras OCR.

---

## Nivel 2 — PDP Food

Cuando tengamos:

```text
product_id
```

consultar:

```text
cloud-api/pdp-food/v1/
```

para enriquecer con:

```text
ingredientes
información nutricional
nutri-score
origen
información adicional
```

---

## Nivel 3 — EAN Scanner

Para códigos de barras:

```text
getProductByEAN
```

sería potencialmente la mejor fuente.

Debe comprobarse qué requisitos reales tiene:

```text
clientId
mallId
session
headers
```

antes de depender de él en producción.

---

# 19. Esquema recomendado en nuestra base de datos

Una posible tabla normalizada:

```sql
products
--------
id
ean
name
brand
description

image_url

source
source_product_id
source_sku_id

price
price_per_unit
measure_unit

ingredients
allergens
nutri_score
nutrition_json

category
subcategory

last_synced_at
raw_source_json
```

Ejemplo:

```text
source = "carrefour"
```

---

# 20. Separar producto de precio

Se recomienda no guardar el precio directamente como propiedad permanente del producto.

Modelo:

```text
products
product_sources
product_prices
```

Ejemplo:

```text
products
--------
ean
name
brand

product_sources
---------------
product_id
source
external_id

product_prices
--------------
product_id
source
store_id
price
promotion
observed_at
```

Razón:

- los precios cambian;
- pueden variar por tienda;
- puede haber promociones;
- `mallId` implica contexto de establecimiento.

---

# 21. Modelo recomendado para información nutricional

```json
{
  "per": "100 ml",
  "energy": null,
  "fat": null,
  "saturatedFat": null,
  "carbohydrates": null,
  "sugars": null,
  "protein": null,
  "salt": null,
  "fiber": null,
  "other": []
}
```

Guardar además:

```text
nutrition_raw
```

para no perder información si Carrefour cambia el formato.

---

# 22. Estrategia para poblar la base de datos

Posibles vías:

## Opción A — búsqueda por términos

Crear una lista de términos comunes:

```text
leche
huevos
arroz
pasta
pollo
tomate
queso
yogur
café
pan
...
```

Después:

```text
query
 ↓
paginación
 ↓
productos
 ↓
EAN
 ↓
deduplicación
```

---

## Opción B — recorrer categorías

```text
unified_menu
 ↓
categorías
 ↓
subcategorías
 ↓
search/filter
 ↓
productos
```

Es preferible si conseguimos identificar cómo se traducen las categorías del menú a filtros del buscador.

---

## Opción C — lazy enrichment

No descargar todo el catálogo.

Flujo:

```text
usuario busca / escanea
        ↓
consultamos Carrefour
        ↓
guardamos producto localmente
        ↓
futuras búsquedas usan nuestra DB
```

Esta estrategia reduce:

- tráfico;
- mantenimiento;
- dependencia;
- coste de sincronización.

Para el MVP probablemente es la mejor opción.

---

# 23. Integración con OCR de tickets

Flujo recomendado:

```text
ticket
 ↓
OCR
 ↓
"LECHE SEMI CARREF"
 ↓
normalización
 ↓
Carrefour Search API
 ↓
candidatos
 ↓
matching
 ↓
producto final
```

Para ranking:

```text
score =
    similitud_nombre
  + coincidencia_marca
  + coincidencia_precio
  + categoría
```

---

# 24. Integración con escáner de códigos

Flujo ideal:

```text
Camera
 ↓
EAN-13
 ↓
buscar primero en nuestra DB
 ↓
si no existe
 ↓
Carrefour EAN/Search API
 ↓
guardar
 ↓
añadir al inventario
```

Fallback recomendado:

```text
Carrefour
 ↓ fallo
OpenFoodFacts
 ↓ fallo
búsqueda manual
```

---

# 25. Cache recomendada

Para no golpear continuamente APIs externas:

```text
product cache: 30 días
nutrition cache: 90 días
image URL: reutilizar
price cache: 6-24 horas
search cache: horas/días
```

La caducidad exacta dependerá de las condiciones de uso y estabilidad observada.

---

# 26. Normalización del EAN

Guardar siempre:

```text
ean_raw
ean_normalized
```

y normalizar:

```text
EAN-8
EAN-13
GTIN
```

Ejemplo:

```python
ean = "".join(filter(str.isdigit, raw_ean))
```

No eliminar ceros iniciales.

---

# 27. Autenticación y sesiones

La infraestructura de Carrefour contiene conceptos como:

```text
JWT
SESSION_TOKEN
Cookie
session_id
IBM API headers
clientId
```

Esto indica que no todos los endpoints son necesariamente públicos.

Especial atención a:

```text
pro.api.carrefour.es
getProductByEAN
pdp-food
```

La Search API parece ser la candidata más sencilla para uso anónimo.

---

# 28. Recomendación de seguridad

No integrar en producción:

- secretos extraídos de la APK;
- tokens embebidos;
- claves privadas;
- sesiones de usuarios;
- credenciales internas.

Sí se puede estudiar:

- endpoints públicos;
- estructuras JSON;
- parámetros;
- comportamiento del cliente;
- modelos de datos;
- mecanismos de búsqueda.

La implementación debería utilizar únicamente endpoints que se comprueben como públicamente accesibles o para los que exista autorización adecuada.

---

# 29. Prioridad de investigación

Orden recomendado:

```text
1. Probar search-api sin autenticación
2. Documentar JSON completo
3. Comprobar paginación
4. Comprobar búsqueda exacta por EAN
5. Probar pdp-food
6. Probar unified_menu
7. Analizar getProductByEAN
8. Investigar mallId
9. Investigar variaciones de precio por tienda
10. Crear adapter Carrefour
```

---

# 30. Adapter recomendado

Interfaz común:

```ts
interface ProductProvider {
  search(query: string): Promise<Product[]>;
  getByEan(ean: string): Promise<Product | null>;
  getDetails(id: string): Promise<ProductDetails | null>;
}
```

Implementación:

```text
CarrefourProvider
MercadonaProvider
DiaProvider
LidlProvider
OpenFoodFactsProvider
```

Esto permite cambiar de fuente sin acoplar el dominio.

---

# 31. Modelo canónico

Ejemplo TypeScript:

```ts
type CanonicalProduct = {
  ean?: string;

  name: string;
  brand?: string;
  description?: string;

  imageUrl?: string;

  quantity?: number;
  unit?: string;

  ingredients?: string;
  allergens?: string[];

  nutrition?: {
    per?: string;
    energy?: number;
    fat?: number;
    saturatedFat?: number;
    carbs?: number;
    sugars?: number;
    protein?: number;
    salt?: number;
    fiber?: number;
  };

  nutriScore?: string;

  source: "carrefour";
  sourceId?: string;

  raw?: unknown;
};
```

---

# 32. Mapper Carrefour → modelo canónico

Ejemplo:

```ts
function mapCarrefourProduct(item: CarrefourProduct): CanonicalProduct {
  return {
    ean: item.ean13 ?? item.ean,
    name: item.display_name ?? item.name,
    brand: item.brand,
    description: item.description,

    imageUrl:
      item.image_path ??
      item.images?.[0] ??
      item.alternative_images?.[0],

    unit: item.measure_unit,

    source: "carrefour",
    sourceId: item.product_id,

    raw: item,
  };
}
```

---

# 33. Flujo backend recomendado

Nunca depender directamente del endpoint desde frontend.

Usar:

```text
PWA
 ↓
/api/products/search
 ↓
backend
 ↓
CarrefourProvider
 ↓
Carrefour API
```

Ventajas:

- cache;
- rate limiting;
- ocultar implementación;
- fallback entre proveedores;
- logging;
- normalización;
- posibilidad de cambiar endpoints.

---

# 34. Endpoints internos sugeridos para nuestra app

```http
GET /api/products/search?q=leche

GET /api/products/ean/:ean

GET /api/products/:id

POST /api/products/resolve
```

Ejemplo:

```http
POST /api/products/resolve
```

```json
{
  "text": "LECHE SEMI CARREFOUR 1L",
  "price": 1.05
}
```

Respuesta:

```json
{
  "confidence": 0.94,
  "product": {}
}
```

---

# 35. Conclusión

Carrefour es una fuente especialmente interesante para **What's in my fridge??** porque la APK revela APIs para:

```text
búsqueda
EAN
precio
imagen
marca
ingredientes
alérgenos
nutrición
Nutri-Score
categorías
promociones
```

La combinación más prometedora es:

```text
Search API
   +
PDP Food
   +
EAN scanner
```

Prioridad inmediata:

```text
probar Search API
 ↓
guardar respuesta JSON real
 ↓
documentar schema
 ↓
crear CarrefourProvider
 ↓
integrarlo con nuestra capa común de supermercados
```

---

# Resumen de endpoints

```text
SEARCH

https://www.carrefour.es/search-api/query/v1/search


PRODUCT DETAIL

https://www.carrefour.es/cloud-api/pdp-food/v1/?product_id=<id>


EAN SCANNER

https://pro.api.carrefour.es/md-transactionMalls-v1/anonymous/Mall/getProductByEAN


CATEGORIES

https://www.carrefour.es/api/unified_menu/{salePoint}/json


SUGGESTIONS

/search-api/suggestions/v1/empathize
/search-api/suggestions/v1/nextqueries
/search-api/suggestions/v1/relatedtags
```

---

**Estado:** investigación estática de APK completada parcialmente.

**Siguiente paso:** validar cada endpoint con peticiones reales y guardar ejemplos de respuesta para definir los adapters definitivos.
