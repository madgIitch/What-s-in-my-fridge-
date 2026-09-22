# Integración técnica con DIA para *What's in my fridge??*

## Objetivo

Documentar los hallazgos realizados sobre la web y una APK decompilada de DIA con el objetivo de poder reutilizarlos en futuras implementaciones del proyecto *What's in my fridge??*.

La integración buscada permite:

- buscar productos por texto;
- obtener SKU, nombre, marca, categoría, imagen, precio y stock;
- acceder al detalle completo de producto;
- extraer ingredientes, nutrición, conservación y fabricante;
- construir un modelo normalizado;
- dejar preparada la integración futura de código de barras EAN → SKU DIA.

---

# 1. Resumen ejecutivo

Actualmente DIA expone dos fuentes útiles:

1. **API pública de búsqueda**
   - endpoint JSON;
   - no requiere login;
   - devuelve catálogo reducido;
   - incluye precio, stock, categoría, marca e imagen.

2. **PDP renderizada por servidor**
   - la página de producto contiene un JSON estructurado embebido;
   - el objeto importante es `INITIAL_STATE.product`;
   - contiene ingredientes, nutrición, conservación, fabricante, imágenes, precio y stock.

El problema pendiente es:

```text
EAN -> SKU DIA
```

Una vez conocido el SKU, el resto de la integración está prácticamente resuelto.

---

# 2. API actual de búsqueda

Endpoint confirmado:

```http
GET https://www.dia.es/api/v1/search-back/search?q={query}
```

Ejemplo:

```http
GET https://www.dia.es/api/v1/search-back/search?q=leche
```

No requiere autenticación.

Headers mínimos usados con éxito:

```http
Accept: application/json
User-Agent: Mozilla/5.0
```

Ejemplo Python:

```python
import requests

r = requests.get(
    "https://www.dia.es/api/v1/search-back/search",
    params={"q": "leche"},
    headers={
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
    },
    timeout=20,
)

data = r.json()
```

---

# 3. Estructura de respuesta de `search-back`

Top-level observado:

```json
{
  "cart": {},
  "customer": {},
  "facets": [],
  "footer": {},
  "header": {},
  "locale": "es",
  "login_status": "ANONYMOUS",
  "pagination": {},
  "query_id": "...",
  "search_items": [],
  "sort": {},
  "suggestions": {},
  "total_items": 0
}
```

Los productos vienen en:

```text
search_items[]
```

Ejemplo real:

```json
{
  "brand": "Dia Láctea",
  "brand_type": "D",
  "dia_brand": true,
  "display_name": "Leche semidesnatada Dia Láctea 1 L",
  "image": "/product_images/504/504_ISO_0_ES.jpg",
  "l1_category_description": "Huevos, leche y mantequilla",
  "l2_category_description": "Leche",
  "object_id": "504",
  "prices": {
    "currency": "EUR",
    "discount_percentage": 0,
    "is_club_price": false,
    "is_promo_price": false,
    "measure_unit": "LITRO",
    "price": 0.84,
    "price_per_unit": 0.84,
    "strikethrough_price": 0.84
  },
  "sku_id": "504",
  "units_in_cart": 0,
  "units_in_stock": 7393,
  "url": "/huevos-leche-y-mantequilla/leche/p/504"
}
```

Campos de interés:

```text
object_id
sku_id
display_name
brand
brand_type
dia_brand
image
l1_category_description
l2_category_description
prices
units_in_stock
url
```

En algunos productos aparecen también:

```text
allergens
product_info
stamp_code
stamp_description
stamp_color
```

Ejemplo:

```json
{
  "allergens": [
    {
      "name": "Sin lactosa"
    }
  ],
  "product_info": "Sin lactosa"
}
```

---

# 4. Facetas disponibles en búsqueda

La búsqueda devuelve facetas útiles para clasificación.

Se han observado, entre otras:

```text
bio
brand_description
caffeine_free
custom_gluten_free
dia_brand
lactose_free
```

Estas facetas pueden ser útiles para filtros o enriquecimiento de catálogo.

---

# 5. Limitación: búsqueda por EAN

Se probó:

```http
GET https://www.dia.es/api/v1/search-back/search?q=8480017013376
```

Resultado:

```json
{
  "search_items": [],
  "total_items": 0
}
```

Conclusión:

```text
search-back NO funciona como lookup EAN directo.
```

---

# 6. PDP / detalle de producto

Ejemplo:

```text
https://www.dia.es/huevos-leche-y-mantequilla/leche/p/504
```

Una petición directa con `requests` puede recibir:

```text
403 Access Denied
errors.edgesuite.net
```

Esto proviene de Akamai / EdgeSuite.

Sin embargo, abriendo la página con un navegador real mediante Playwright se obtiene:

```text
STATUS 200
```

---

# 7. Arquitectura del PDP

Al observar las peticiones del navegador aparecen:

```http
GET /api/v1/pdp-insight/initial_analytics/504
GET /api/v1/pdp-insight/ad_placements/504
```

Pero estas llamadas NO contienen el detalle principal del producto.

La ficha completa viene renderizada por servidor.

El HTML contiene un `<script>` con un JSON que incluye:

```text
INITIAL_STATE.product
```

Ese objeto es la fuente principal para extraer el detalle.

---

# 8. Extracción de `INITIAL_STATE.product`

Ejemplo de parser:

```python
import json
from bs4 import BeautifulSoup


def extract_dia_product(html_path):
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    soup = BeautifulSoup(html, "html.parser")

    for script in soup.find_all("script"):
        content = script.string

        if not content:
            continue

        if (
            '"INITIAL_STATE"' in content
            and '"product"' in content
            and '"sku_id"' in content
        ):
            try:
                data = json.loads(content)

                product = (
                    data
                    .get("INITIAL_STATE", {})
                    .get("product")
                )

                if product:
                    return product

            except json.JSONDecodeError:
                continue

    return None
```

---

# 9. Ejemplo de objeto PDP

Para SKU `504`:

```json
{
  "breadcrumb": [
    {
      "link": "/huevos-leche-y-mantequilla/c/L108",
      "title": "Huevos, leche y mantequilla"
    },
    {
      "link": "/huevos-leche-y-mantequilla/leche/c/L2051",
      "title": "Leche"
    }
  ],
  "images": [
    "/product_images/504/504_ISO_0_ES.jpg",
    "/product_images/504/504_FRO_0_ES.jpg",
    "/product_images/504/504_TRA_0_ES.jpg",
    "/product_images/504/504_LAT_0_ES.jpg"
  ],
  "info_labels": [
    "Tipo de leche: Semidesnatada"
  ],
  "ingredients": {
    "text": "<p><strong>Leche&nbsp;</strong>semidesnatada de vaca.</p>",
    "title": "Ingredientes"
  },
  "instructions": {
    "storage_instructions": {
      "text": "Conservar en un lugar fresco y seco. Una vez abierto, mantener en refrigeración y consumir en los 3 días siguientes.",
      "title": "Instrucciones de almacenaje"
    }
  },
  "manufacturer_contact": {
    "manufacturer_contact_address": "Camino de Purchil, 66, 18004 Granada, España.",
    "manufacturer_contact_name": "Lactalis P., S.L."
  },
  "prices": {
    "currency": "EUR",
    "measure_unit": "LITRO",
    "price": 0.84,
    "price_per_unit": 0.84,
    "strikethrough_price": 0.84
  },
  "primary_info": {
    "title": "Leche semidesnatada Dia Láctea 1 L"
  },
  "product_info": {
    "product": "Leche semidesnatada UHT.",
    "subtitle": "Contenido neto: 1L"
  },
  "sku_id": "504",
  "units_in_cart": 0,
  "units_in_stock": 7390
}
```

---

# 10. Nutrición

El bloque nutricional viene estructurado.

Ejemplo:

```json
{
  "nutri_measurement_unit": {
    "name": "Medida tamaño",
    "value": "ml"
  },
  "nutri_size": {
    "name": "Tamaño en origen",
    "value": 100
  },
  "nutritional_values": {
    "energy_value": 46,
    "energy_value_kj": 192,
    "measure_unit": "kcal",
    "measure_unit_kj": "kJ",
    "values": [
      {
        "measure_unit": "g",
        "title": "Grasas",
        "value": 1.6,
        "items": [
          {
            "measure_unit": "g",
            "title": "de las cuales saturadas",
            "value": 1.1
          }
        ]
      },
      {
        "measure_unit": "g",
        "title": "Hidratos de Carbono",
        "value": 4.7,
        "items": [
          {
            "measure_unit": "g",
            "title": "de los cuales azúcares",
            "value": 4.7
          }
        ]
      },
      {
        "measure_unit": "g",
        "title": "Proteínas",
        "value": 3.1
      },
      {
        "measure_unit": "g",
        "title": "Sal",
        "value": 0.1
      }
    ]
  }
}
```

Vitaminas/minerales:

```json
{
  "vitamins": {
    "values": [
      {
        "measure_unit": "mg",
        "title": "Calcio",
        "value": 110,
        "value_per_100_g": 0.11
      }
    ]
  }
}
```

Nota:

`value_per_100_g` parece ser un campo interno con conversiones inconsistentes de unidad.

Ejemplo:

```text
Calcio = 110 mg
value_per_100_g = 0.11
```

Para el modelo normalizado conviene usar:

```text
calcium_mg = 110
```

y conservar también el objeto raw.

---

# 11. Modelo normalizado recomendado

Ejemplo:

```json
{
  "source": "dia",
  "sku": "504",
  "name": "Leche semidesnatada Dia Láctea 1 L",
  "description": "Leche semidesnatada UHT.",
  "net_content": "Contenido neto: 1L",
  "ingredients": "Leche semidesnatada de vaca.",
  "labels": [
    "Tipo de leche: Semidesnatada"
  ],
  "images": [
    "https://www.dia.es/product_images/504/504_ISO_0_ES.jpg"
  ],
  "price": 0.84,
  "currency": "EUR",
  "price_per_unit": 0.84,
  "measure_unit": "LITRO",
  "stock": 7390,
  "storage": "Conservar en un lugar fresco y seco...",
  "manufacturer": "Lactalis P., S.L.",
  "manufacturer_address": "Camino de Purchil, 66, 18004 Granada, España.",
  "nutrition": {}
}
```

---

# 12. Normalización nutricional recomendada

Además de guardar el JSON raw, conviene construir:

```json
{
  "nutrition_basis": {
    "amount": 100,
    "unit": "ml"
  },
  "energy_kcal": 46,
  "energy_kj": 192,
  "fat_g": 1.6,
  "saturated_fat_g": 1.1,
  "carbohydrates_g": 4.7,
  "sugars_g": 4.7,
  "protein_g": 3.1,
  "salt_g": 0.1,
  "minerals": {
    "calcium_mg": 110
  }
}
```

Recomendación:

```text
guardar nutrition_raw + nutrition_normalized
```

Esto protege frente a cambios de schema.

---

# 13. Parser de producto recomendado

```python
from bs4 import BeautifulSoup


def clean_html(value):
    if not value:
        return None

    return BeautifulSoup(
        value,
        "html.parser"
    ).get_text(
        " ",
        strip=True
    )


def normalize_dia_product(product):
    nutrition = product.get("nutritional_info", {})
    prices = product.get("prices", {})
    manufacturer = product.get("manufacturer_contact", {})
    instructions = product.get("instructions", {})
    ingredients = product.get("ingredients", {})
    primary_info = product.get("primary_info", {})
    product_info = product.get("product_info", {})

    return {
        "source": "dia",
        "sku": product.get("sku_id"),
        "name": primary_info.get("title"),
        "description": product_info.get("product"),
        "net_content": product_info.get("subtitle"),

        "ingredients": clean_html(
            ingredients.get("text")
        ),

        "labels": product.get(
            "info_labels",
            []
        ),

        "images": [
            "https://www.dia.es" + image
            for image in product.get("images", [])
        ],

        "price": prices.get("price"),
        "currency": prices.get("currency"),
        "price_per_unit": prices.get("price_per_unit"),
        "measure_unit": prices.get("measure_unit"),

        "stock": product.get("units_in_stock"),

        "storage": (
            instructions
            .get("storage_instructions", {})
            .get("text")
        ),

        "manufacturer": manufacturer.get(
            "manufacturer_contact_name"
        ),

        "manufacturer_address": manufacturer.get(
            "manufacturer_contact_address"
        ),

        "nutrition": nutrition,
    }
```

---

# 14. Categorías

El endpoint:

```http
GET /api/v1/pdp-insight/initial_analytics/{sku}
```

devuelve también el árbol completo de categorías dentro de:

```text
menu_analytics
```

Ejemplo:

```text
L108
├── L2051 Leche
├── L2052 Bebidas vegetales y horchatas
├── L2053 Batidos
├── L2054 Nata
├── L2055 Huevos
├── L2056 Mantequilla y margarina
├── L2261 Leche sin lactosa y enriquecidas
├── L2262 Leche infantil
└── L2264 Leche condensada y evaporada
```

Esto puede servir para:

- construir el árbol de categorías;
- enumerar páginas de categoría;
- poblar catálogo completo;
- mapear productos a categorías.

---

# 15. Páginas de categoría

Ejemplo válido:

```text
https://www.dia.es/charcuteria/jamon-cocido/c/L2001
```

La página responde `200` y contiene JSON-LD con productos.

Ejemplo:

```json
{
  "@type": "Product",
  "image": "https://www.dia.es/product_images/273737/273737_ISO_0_ES.jpg",
  "name": "Jamón cocido extra 97% Dia Nuestra Alacena 150 g",
  "offers": {
    "@type": "Offer",
    "availability": "https://schema.org/InStock",
    "price": 1.99,
    "priceCurrency": "EUR"
  }
}
```

La URL permite recuperar el SKU:

```text
/p/273737
```

Sin embargo, para catálogo el endpoint `search-back` es más útil que parsear JSON-LD.

---

# 16. Endpoint `plp-back`

Se probó inicialmente:

```http
GET /api/v1/plp-back/products?navigation=L108
```

Resultado:

```text
404
```

También se encontró código histórico usando:

```text
/api/v1/plp-back/reduced/...
```

Actualmente esa ruta puede redirigir a HTML de categoría.

Conclusión:

```text
No depender de plp-back para la implementación nueva.
```

Usar preferentemente:

```text
search-back
+
categorías SSR / menu_analytics
```

---

# 17. APK antigua analizada

La APK decompilada corresponde a una versión antigua:

```text
APPLICATION_ID = es.dia
VERSION_NAME = 4.6.2
VERSION_CODE = 201
```

No representa necesariamente la arquitectura actual.

Aun así permitió descubrir endpoints históricos importantes.

---

# 18. API antigua de DIA

Base histórica:

```text
https://clubdia.dia.es/webdiaWS/
```

Endpoints observados:

```text
/rest/get/codigo-barras-articulo/{storeId}/{code}

/rest/get/busqueda-articulos-literal/{storeId}/{filter}/{pageIndex}

/rest/get/busqueda-articulos-similar/{storeId}/{itemId}/{pageIndex}/{filter}

/rest/get/cupones-articulo/{storeId}/{typeItem}/{itemCode}

/rest/get/detalle-tienda/{storeId}

/api/rest/shop-details

/api/rest/shopping-list/search_products

/api/rest/shopping-list

/api/rest/shopping-list/{id}
```

---

# 19. Endpoint antiguo EAN → producto

El hallazgo más importante de la APK antigua:

```http
GET https://clubdia.dia.es/webdiaWS/rest/get/codigo-barras-articulo/{storeId}/{code}
```

Interfaz Retrofit observada:

```java
@GET("/rest/get/codigo-barras-articulo/{storeId}/{code}")
ResponseDTO<ItemDTO> getItemByEAN(
    @Header("clubdia-auth-header") String auth,
    @Path("storeId") Long storeId,
    @Path("code") String ean
);
```

El escáner usaba ZXing y enviaba directamente el código leído al backend.

Flujo histórico:

```text
Cámara
  ↓
ZXing
  ↓
EAN
  ↓
codigo-barras-articulo
  ↓
ItemDTO
```

No se observó transformación del EAN.

---

# 20. Estado actual del endpoint EAN histórico

Prueba realizada:

```http
GET https://clubdia.dia.es/webdiaWS/rest/get/codigo-barras-articulo/0/8480017013376
```

Respuesta:

```http
401 Unauthorized
```

Body:

```json
{
  "error": {
    "descripcion": "No autorizado",
    "codError": "401"
  },
  "respuesta": []
}
```

Conclusión:

```text
El endpoint sigue resolviendo en servidor,
pero requiere clubdia-auth-header.
```

Esto es distinto de un `404`.

---

# 21. Otros endpoints históricos probados

Búsqueda literal:

```text
/rest/get/busqueda-articulos-literal/0/leche/0
```

Resultado:

```text
404 Recurso no encontrado
```

Probablemente retirado.

Shopping-list:

```text
/api/rest/shopping-list/search_products
```

Resultado:

```text
400
Missing request header clubdia-auth-header
```

El endpoint sigue existiendo, pero requiere autenticación.

---

# 22. Autenticación histórica

La APK antigua usaba:

```http
clubdia-auth-header: <token>
```

El token se obtenía históricamente mediante:

```text
POST /rest/get/autorizacion
```

El servidor devolvía:

```text
clubdia-auth-header
```

No se recomienda basar una integración futura en esta API antigua salvo que sea estrictamente necesario.

---

# 23. Modelo histórico `ItemDTO`

Campos encontrados:

```text
id
codigo
descripcion
descrPublicidad
seccionesCodigo
familiasCodigo
urlFotoArticulo
imagen
tipo
cantidad
estaDisponible
eliminado
tieneOferta
tieneCupon
tieneCuponSeleccionable
unidadPeso
lineal
misspelling
misspellingSeleccionado
```

Esto confirma que históricamente DIA soportaba:

```text
EAN -> producto
```

---

# 24. Imágenes históricas

Rutas detectadas:

```text
https://clubdia.dia.es/productos.html
?action=getImagen
&tamanyo=PEQ
&codigoProducto={productCode}
```

También:

```text
https://clubdia.dia.es/imagenesProductosGenericos.html?id={id}
```

La integración nueva debe usar preferentemente:

```text
https://www.dia.es/product_images/{SKU}/...
```

---

# 25. Contexto de tienda / zona

Se han observado respuestas con:

```text
postal_code = 28041
shop_id = 13835
```

Esto indica que:

```text
precio
stock
disponibilidad
```

pueden depender de tienda o zona.

No deben tratarse como datos globales e inmutables.

Recomendación:

guardar también:

```text
shop_id
postal_code
retrieved_at
```

cuando se persistan precios o stock.

---

# 26. Estrategia recomendada para producción

Arquitectura propuesta:

```text
                    DIA
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
     search-back             PDP SSR
          │                     │
          ▼                     ▼
   catálogo reducido    INITIAL_STATE.product
          │                     │
          ├─ SKU                ├─ ingredientes
          ├─ nombre             ├─ nutrición
          ├─ marca              ├─ conservación
          ├─ categorías         ├─ fabricante
          ├─ imagen             ├─ imágenes
          ├─ precio             ├─ precio
          └─ stock              └─ stock
```

Pipeline recomendado:

```text
1. search-back
2. obtener SKU + URL
3. cargar PDP con navegador real o mecanismo compatible con SSR
4. extraer INITIAL_STATE.product
5. normalizar
6. persistir
```

---

# 27. Arquitectura objetivo con EAN

Cuando se resuelva el barcode lookup:

```text
EAN
 ↓
resolver SKU DIA
 ↓
search-back
 +
PDP SSR
 ↓
producto completo
 ↓
What's in my fridge??
```

---

# 28. Problema pendiente principal

La única pieza importante aún no resuelta es:

```text
EAN -> SKU DIA
```

Vías posibles:

1. analizar la APK actual de DIA;
2. observar tráfico del escáner actual;
3. identificar si existe un endpoint moderno de barcode;
4. reutilizar de forma legítima una sesión propia si el endpoint histórico continúa siendo necesario.

No hace falta investigar más la PDP: el detalle ya está resuelto mediante `INITIAL_STATE.product`.

---

# 29. Consideraciones para Supabase

Campos recomendados para una tabla de catálogo:

```text
id
source
external_sku
name
brand
description
net_content
ingredients
labels
category_l1
category_l2
images
manufacturer
manufacturer_address
storage
nutrition_raw
nutrition_normalized
created_at
updated_at
```

Para precio/stock conviene usar tabla separada:

```text
product_id
source
shop_id
postal_code
price
currency
price_per_unit
measure_unit
stock
retrieved_at
```

Motivo:

```text
precio y stock son variables temporales y regionales.
```

---

# 30. Recomendaciones de robustez

No asumir que:

```text
stock
precio
categorías
schema nutricional
```

son permanentes.

Guardar siempre el payload raw cuando sea posible.

Ejemplo:

```text
raw_search_payload
raw_product_payload
nutrition_raw
```

y convertirlo después a campos internos.

También conviene:

- limitar frecuencia de peticiones;
- cachear resultados por SKU;
- registrar `retrieved_at`;
- detectar cambios de schema;
- usar timeouts;
- implementar retries conservadores;
- separar catálogo estático de precio/stock dinámico.

---

# 31. Estado actual

## Confirmado

- búsqueda pública por texto;
- catálogo básico;
- SKU interno;
- precio;
- precio por unidad;
- stock;
- categorías;
- imágenes;
- labels y algunos alérgenos;
- PDP accesible desde navegador;
- JSON SSR;
- ingredientes;
- nutrición;
- vitaminas/minerales;
- conservación;
- fabricante;
- árbol de categorías;
- endpoint histórico EAN todavía responde.

## No confirmado

- endpoint moderno EAN;
- lookup directo `EAN -> SKU`;
- estabilidad contractual de endpoints internos;
- comportamiento por diferentes tiendas/postales;
- necesidad de navegador real en producción para PDP.

---

# 32. Próxima tarea recomendada

Investigar exclusivamente:

```text
EAN -> SKU
```

Prioridad:

```text
APK DIA actual
        ↓
escáner
        ↓
capturar request
        ↓
identificar endpoint moderno
        ↓
probar sin sesión / con sesión propia
```

Una vez resuelto esto, la integración de DIA puede considerarse funcionalmente completa para el caso de uso del proyecto.

---

# 33. Resumen mínimo para implementación

```text
BÚSQUEDA
GET https://www.dia.es/api/v1/search-back/search?q={query}

DETALLE
GET página PDP:
https://www.dia.es/{cat1}/{cat2}/p/{sku}

Extraer:
INITIAL_STATE.product

CLAVE
sku_id

PENDIENTE
EAN -> sku_id
```

