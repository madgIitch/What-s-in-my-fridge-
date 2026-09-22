# Lidl España — extracción de catálogo de productos desde Lidl Plus

## Objetivo

Documentar todo lo descubierto sobre cómo obtener productos de Lidl España directamente desde los servicios utilizados por la app de Lidl Plus, sin scraping HTML.

Este documento recoge únicamente lo necesario para:

- localizar tiendas Lidl;
- obtener un `storeKey`;
- obtener categorías y subcategorías;
- paginar productos;
- obtener el catálogo completo de una tienda;
- consultar productos individuales;
- realizar búsquedas;
- interpretar la estructura de los productos devueltos;
- guardar el resultado para usarlo posteriormente en el proyecto.

---

# 1. Arquitectura descubierta

Lidl Plus utiliza al menos dos servicios distintos relevantes para esta tarea:

```text
https://stores.lidlplus.com/
https://product-catalog.lidlplus.com/
```

El flujo general es:

```text
stores.lidlplus.com
        ↓
buscar tiendas
        ↓
storeKey
        ↓
product-catalog.lidlplus.com
        ↓
categorías
        ↓
subcategorías, si existen
        ↓
productos paginados
```

No ha sido necesario:

- iniciar sesión;
- usar token de usuario;
- disponer de cookies;
- hacer scraping de HTML;
- automatizar navegador.

Las peticiones probadas responden directamente mediante HTTP.

---

# 2. Servicio de tiendas

Base URL:

```text
https://stores.lidlplus.com/api/
```

## 2.1. Buscar tiendas

Endpoint:

```http
GET /v1/autocomplete/{country}
```

Para España:

```http
GET https://stores.lidlplus.com/api/v1/autocomplete/ES
```

Parámetros exactos:

| Parámetro | Tipo | Ejemplo |
|---|---:|---|
| `input` | string | `Madrid` |
| `language` | string | `es` |
| `latitude` | number | `40.4168` |
| `longitude` | number | `-3.7038` |

Ejemplo:

```python
import requests

url = "https://stores.lidlplus.com/api/v1/autocomplete/ES"

r = requests.get(
    url,
    params={
        "input": "Madrid",
        "language": "es",
        "latitude": 40.4168,
        "longitude": -3.7038,
    }
)

print(r.status_code)
print(r.url)
print(r.text)
```

Una llamada verificada devuelve `HTTP 200`.

Ejemplo de respuesta:

```json
[
  {
    "storeKey": "ES0549",
    "name": "Tirso Molina",
    "address": "Plaza Tirso de Molina, 16",
    "locality": "Madrid",
    "distance": 480.9277945220971,
    "postalCode": "28012",
    "location": {
      "latitude": 40.41252,
      "longitude": -3.70462
    }
  }
]
```

Campos relevantes:

```text
storeKey
name
address
locality
distance
postalCode
location.latitude
location.longitude
```

El identificador que necesita después el catálogo es:

```text
storeKey
```

Ejemplo:

```text
ES0549
```

## 2.2. Error importante descubierto

Inicialmente se probaron incorrectamente:

```text
lat
lon
```

El endpoint espera exactamente:

```text
latitude
longitude
```

Usar `lat` / `lon` provoca `HTTP 400`.

---

# 3. Servicio de catálogo

Base URL:

```text
https://product-catalog.lidlplus.com/
```

Base práctica usada:

```text
https://product-catalog.lidlplus.com/api/app/v1
```

Variables:

```python
BASE = "https://product-catalog.lidlplus.com/api/app/v1"
COUNTRY = "ES"
STORE = "ES0549"
```

---

# 4. Cabecera necesaria

Las llamadas al catálogo requieren idioma.

La cabecera que funciona es:

```http
Accept-Language: es
```

En `requests`:

```python
headers = {
    "Accept-Language": "es"
}
```

Sin idioma, el servidor respondió con un error de validación equivalente a:

```json
[
  {
    "propertyName": "Language",
    "errorMessage": "The specified condition was not met for 'Language'.",
    "attemptedValue": null
  }
]
```

---

# 5. Obtener categorías

Endpoint:

```http
GET /api/app/v1/{country}/store/{storeId}/categories
```

España:

```http
GET https://product-catalog.lidlplus.com/api/app/v1/ES/store/{storeId}/categories
```

Ejemplo:

```python
r = requests.get(
    f"{BASE}/{COUNTRY}/store/{STORE}/categories",
    headers={"Accept-Language": "es"}
)

r.raise_for_status()
data = r.json()
```

La respuesta real verificada tiene esta forma:

```json
{
  "categories": [
    {
      "id": "90",
      "name": "Pan y Bollería",
      "imageUrl": "https://...",
      "hasSubcategories": false
    },
    {
      "id": "40",
      "name": "Congelados",
      "imageUrl": "https://...",
      "hasSubcategories": true
    }
  ]
}
```

Por tanto:

```python
categories = r.json()["categories"]
```

Campos:

```text
id
name
imageUrl
hasSubcategories
```

---

# 6. Categorías observadas en la tienda probada

En la tienda `ES0549` se obtuvieron:

```text
90  Pan y Bollería
10  Fruta y verdura
30  Carne
32  Pescado
40  Congelados
60  Despensa
50  Nevera
```

Las categorías:

```text
Congelados
Despensa
Nevera
```

tenían subcategorías.

---

# 7. Obtener productos de una categoría

Para categorías con:

```json
"hasSubcategories": false
```

se usa:

```http
GET /api/app/v1/{country}/store/{storeId}/categories/{categoryId}/products
```

Ejemplo:

```http
GET https://product-catalog.lidlplus.com/api/app/v1/ES/store/ES0549/categories/90/products
```

Parámetros:

```text
skip
limit
date
```

Ejemplo:

```python
r = requests.get(
    f"{BASE}/{COUNTRY}/store/{STORE}/categories/90/products",
    headers={"Accept-Language": "es"},
    params={
        "skip": 0,
        "limit": 100
    }
)

r.raise_for_status()
data = r.json()
```

Respuesta:

```json
{
  "id": "90",
  "title": "Pan y Bollería",
  "totalProducts": 62,
  "products": [
    ...
  ]
}
```

Campos del contenedor:

```text
id
title
totalProducts
products
```

---

# 8. Paginación

El endpoint usa:

```text
skip
limit
```

La estrategia verificada es:

```python
skip = 0
limit = 100
```

y después:

```python
skip += len(batch)
```

hasta alcanzar:

```text
totalProducts
```

Ejemplo real:

```text
Fruta y verdura 100/137
Fruta y verdura 137/137
```

Otra categoría:

```text
Cosmética 100/170
Cosmética 170/170
```

---

# 9. Obtener subcategorías

Para categorías cuyo campo:

```json
"hasSubcategories": true
```

se usa:

```http
GET /api/app/v1/{country}/store/{storeId}/categories/{categoryId}/categories
```

Ejemplo:

```http
GET https://product-catalog.lidlplus.com/api/app/v1/ES/store/ES0549/categories/60/categories
```

La respuesta contiene otra colección:

```json
{
  "categories": [
    {
      "id": "...",
      "name": "...",
      ...
    }
  ]
}
```

---

# 10. Productos de una subcategoría

Endpoint:

```http
GET /api/app/v1/{country}/store/{storeId}/categories/{categoryId}/categories/{subcategoryId}/products
```

También utiliza:

```text
skip
limit
date
```

Ejemplo conceptual:

```python
url = (
    f"{BASE}/{COUNTRY}/store/{STORE}"
    f"/categories/{category_id}"
    f"/categories/{subcategory_id}"
    f"/products"
)
```

---

# 11. Subcategorías observadas

## Congelados

```text
Pescado
Fruta, verdura
Helados
Platos preparados
```

## Despensa

```text
Productos básicos
Aperitivos, snacks
Pan, Bollería
Conservas y encurtidos
Leches, bebidas vegetales
Bebidas sin alcohol
Cerveza y sidras
Embutidos
Quesos
Café, cacao, infusiones
Huevos
Conservas de pescado
Platos preparados
Papel, higiene, pañales
Limpieza
Cosmética
Vinos y cavas
Licores
Caldos y sopas
Aceites, mantequillas
Untables
Chocolate y caramelos
Especias, condimentos
Alimentos para mascota
Alimentos para bebé
Artículos del hogar
Parafarmacia
```

## Nevera

```text
Postres y lácteos
Embutidos
Quesos
Platos preparados
Zumos
```

---

# 12. Script completo funcional

```python
import requests
import json

BASE = "https://product-catalog.lidlplus.com/api/app/v1"
COUNTRY = "ES"
STORE = "ES0549"

headers = {
    "Accept-Language": "es"
}

session = requests.Session()
session.headers.update(headers)


def get_products(url):
    products = []

    skip = 0
    limit = 100

    while True:
        r = session.get(
            url,
            params={
                "skip": skip,
                "limit": limit
            }
        )

        r.raise_for_status()

        data = r.json()
        batch = data.get("products", [])

        products.extend(batch)

        total = data.get("totalProducts")

        print(
            data.get("title"),
            f"{len(products)}/{total}"
        )

        if not batch:
            break

        skip += len(batch)

        if total is not None and skip >= int(total):
            break

    return products


r = session.get(
    f"{BASE}/{COUNTRY}/store/{STORE}/categories"
)

r.raise_for_status()

categories = r.json()["categories"]

all_products = []


for category in categories:

    category_id = category["id"]
    category_name = category["name"]

    print("\nCATEGORY:", category_name)

    if not category["hasSubcategories"]:

        url = (
            f"{BASE}/{COUNTRY}/store/{STORE}"
            f"/categories/{category_id}/products"
        )

        products = get_products(url)

        for p in products:
            p["_category"] = category_name
            p["_subcategory"] = None

        all_products.extend(products)

    else:

        r = session.get(
            f"{BASE}/{COUNTRY}/store/{STORE}"
            f"/categories/{category_id}/categories"
        )

        r.raise_for_status()

        subcategories = r.json()["categories"]

        for subcategory in subcategories:

            subcategory_id = subcategory["id"]
            subcategory_name = subcategory["name"]

            print("  SUBCATEGORY:", subcategory_name)

            url = (
                f"{BASE}/{COUNTRY}/store/{STORE}"
                f"/categories/{category_id}"
                f"/categories/{subcategory_id}"
                f"/products"
            )

            products = get_products(url)

            for p in products:
                p["_category"] = category_name
                p["_subcategory"] = subcategory_name

            all_products.extend(products)


print("\nTOTAL PRODUCTOS:", len(all_products))


with open(
    "lidl_products.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        all_products,
        f,
        ensure_ascii=False,
        indent=2
    )
```

---

# 13. Resultado obtenido

Con:

```text
STORE = ES0549
```

Tienda:

```text
Tirso Molina
Plaza Tirso de Molina, 16
Madrid
```

se descargaron:

```text
TOTAL PRODUCTOS: 2257
```

Por tanto, la extracción completa de catálogo ya está funcionando.

---

# 14. Estructura real de un producto

Ejemplo real:

```json
{
  "id": "8807458416491_ES",
  "brand": null,
  "title": "Baguetina",
  "subtitle": null,
  "imageUrl": "https://static-product-catalog.lidlplus.com/images/productdata/ES/original/highres/5707881_9460_v1_highres.png?im=Resize=(384)",
  "price": {
    "price": 0.29,
    "priceWithoutDeposit": 0.29,
    "deposit": null,
    "symbol": "€",
    "discount": null,
    "oldPrice": null,
    "annotations": [
      "1kg = 2.90",
      "100g"
    ],
    "annotationsWithoutDeposit": [
      "1kg = 2.90",
      "100g"
    ],
    "lidlPlusOffer": null
  },
  "stockAvailability": {
    "stockIndicator": "Available"
  },
  "ageLimit": null,
  "productLine": "Food",
  "listingType": "Assortment",
  "productValidForClickAndCollect": true,
  "totalCoupons": 0,
  "_category": "Pan y Bollería",
  "_subcategory": null
}
```

---

# 15. Campos disponibles

## Identificación

```text
id
brand
title
subtitle
```

## Imagen

```text
imageUrl
```

Las imágenes se sirven desde:

```text
https://static-product-catalog.lidlplus.com/
```

Ejemplo:

```text
https://static-product-catalog.lidlplus.com/images/productdata/ES/original/highres/...
```

También aparecen placeholders:

```text
https://static-product-catalog.lidlplus.com/images/common/ImagePlaceholderMedium.png
```

---

# 16. Precio

Objeto:

```json
"price": {
  "price": 0.29,
  "priceWithoutDeposit": 0.29,
  "deposit": null,
  "symbol": "€",
  "discount": null,
  "oldPrice": null,
  "annotations": [
    "1kg = 2.90",
    "100g"
  ],
  "annotationsWithoutDeposit": [
    "1kg = 2.90",
    "100g"
  ],
  "lidlPlusOffer": null
}
```

Campos:

```text
price
priceWithoutDeposit
deposit
symbol
discount
oldPrice
annotations
annotationsWithoutDeposit
lidlPlusOffer
```

---

# 17. Cantidad / formato del producto

En muchos productos, el último elemento de:

```text
price.annotations
```

representa el formato comercial.

Ejemplos reales:

```text
100g
138g
250g
550g
4x60g
2kg
2.5kg
1kg
3pieces
4pieces
```

Extracción simple:

```python
annotations = product["price"].get("annotations", [])

quantity_text = annotations[-1] if annotations else None
```

Importante: no asumir que siempre será peso.

También aparecen unidades:

```text
pieces
kg
g
```

Por ejemplo:

```text
3pieces
1pieces
6pieces
```

---

# 18. Precio por unidad

En muchos casos el primer elemento de `annotations` contiene precio por unidad:

```text
1kg = 2.90
1kg = 5.89
```

Pero no está presente en todos los productos.

Ejemplo:

```json
"annotations": [
  "250g"
]
```

Por tanto, debe tratarse como opcional.

---

# 19. Stock

Ejemplo:

```json
"stockAvailability": {
  "stockIndicator": "Available"
}
```

Valores observados:

```text
Available
LowStock
NoStock
```

También puede aparecer:

```json
"stockAvailability": null
```

Por tanto:

```python
stock = (
    product.get("stockAvailability") or {}
).get("stockIndicator")
```

---

# 20. Ofertas Lidl Plus

Algunos productos incluyen:

```text
price.lidlPlusOffer
```

Ejemplo real:

```json
{
  "largePartNumeric": 1.29,
  "smallPartNumeric": 1.89,
  "largePartString": null,
  "smallPartString": null,
  "hasAsterisk": false,
  "priceSymbol": "€",
  "discountMessage": "-31%",
  "pricePerUnit": null,
  "packaging": null,
  "lowestPrice": null,
  "startValidityDateUtc": "2026-09-20T22:00:01Z",
  "endValidityDateUtc": "2026-09-27T21:59:59Z",
  "category": "Store",
  "termsAndConditionsDescription": "..."
}
```

Campos observados:

```text
largePartNumeric
smallPartNumeric
largePartString
smallPartString
hasAsterisk
priceSymbol
discountMessage
pricePerUnit
packaging
lowestPrice
startValidityDateUtc
endValidityDateUtc
category
termsAndConditionsDescription
```

Por tanto, el catálogo permite recuperar también promociones activas.

---

# 21. Tipo de producto

Campo:

```text
productLine
```

Valores observados:

```text
Food
FruitsAndVegetables
```

Probablemente existan más valores en el catálogo completo.

---

# 22. Tipo de listado

Campo:

```text
listingType
```

Valor observado frecuentemente:

```text
Assortment
```

---

# 23. Click & Collect

Campo:

```text
productValidForClickAndCollect
```

Ejemplo:

```json
true
```

Se ha observado que algunos productos con:

```text
NoStock
```

tienen:

```json
"productValidForClickAndCollect": false
```

aunque no conviene asumir una equivalencia absoluta sin validarlo en todo el catálogo.

---

# 24. Edad mínima

Campo:

```text
ageLimit
```

En los ejemplos observados:

```json
null
```

Puede ser útil para bebidas alcohólicas u otros productos restringidos.

---

# 25. Cupones

Campo:

```text
totalCoupons
```

Ejemplo:

```json
0
```

---

# 26. Identificador del producto

Ejemplo:

```text
8807458416491_ES
```

También existen identificadores del tipo:

```text
INT_5723264_ES
INT_5722851_ES
INT_5722173_ES
```

Por tanto, **no debe asumirse que `id` sea siempre un EAN/GTIN**.

Aunque muchos IDs comienzan con 13 dígitos:

```text
8807458416491_ES
```

otros claramente son IDs internos.

Recomendación:

```text
guardar `id` completo como `lidl_product_id`
```

y no tratarlo automáticamente como:

```text
barcode
EAN
GTIN
```

sin una validación específica.

---

# 27. Duplicidad de nombres

Hay productos diferentes con el mismo nombre.

Ejemplo observado:

```text
Croissant de mantequilla
Croissant de mantequilla
```

con IDs distintos y pesos distintos.

También:

```text
Mollete
Mollete
```

Esto confirma que:

```text
title
```

NO debe usarse como identificador único.

El identificador debe ser:

```text
id
```

---

# 28. Productos a granel

Algunos productos se venden por peso.

Ejemplos:

```text
Banana
Berenjena
Boniato
Calabacín
Mango
Patata granel
```

En esos casos:

```json
"annotations": [
  "1kg"
]
```

y el precio parece representar:

```text
€/kg
```

Esto debe tenerse en cuenta al modelar cantidades en el proyecto.

---

# 29. Productos por unidades

Otros utilizan:

```text
pieces
```

Ejemplos:

```text
3pieces
2pieces
1pieces
6pieces
```

Por tanto, la lógica de normalización debería reconocer al menos:

```text
g
kg
ml
l
pieces
x
```

---

# 30. Posibles errores de datos

Se observó al menos un formato sospechoso:

```text
0.04g
```

en:

```text
Mini croissant crema de avellana
```

mientras el precio por kilo sugería que probablemente el valor real esperado fuese cercano a:

```text
40g
```

Conclusión:

los datos del proveedor pueden contener errores.

No conviene asumir que todas las cantidades son semánticamente correctas.

---

# 31. Endpoint de detalle de producto

Ruta identificada:

```http
GET /api/app/v1/{country}/store/{storeId}/products/{productId}
```

Admite opcionalmente:

```text
date
```

Ejemplo conceptual:

```python
product_id = "8807458416491_ES"

r = session.get(
    f"{BASE}/ES/store/{STORE}/products/{product_id}"
)

r.raise_for_status()

product = r.json()
```

Este endpoint puede ser útil para obtener información adicional no presente en las respuestas resumidas del catálogo.

---

# 32. Endpoint de búsqueda

Ruta identificada:

```http
GET /api/app/v1/{country}/store/{storeId}/search
```

Parámetros:

```text
q
date
```

Ejemplo conceptual:

```python
r = session.get(
    f"{BASE}/ES/store/{STORE}/search",
    params={
        "q": "leche"
    }
)

r.raise_for_status()

results = r.json()
```

---

# 33. Parámetro `date`

Se identificó un parámetro opcional:

```text
date
```

en endpoints de productos, búsqueda y detalle.

Formato esperado:

```text
YYYY-MM-DD
```

Ejemplo conceptual:

```python
params = {
    "date": "2026-09-22"
}
```

Puede servir para consultar contexto de catálogo/promociones asociado a una fecha.

No se ha explorado todavía su comportamiento exacto.

---

# 34. Lista resumida de endpoints

## Tiendas

```http
GET https://stores.lidlplus.com/api/v1/autocomplete/{country}
```

Parámetros:

```text
input
language
latitude
longitude
```

---

## Categorías

```http
GET https://product-catalog.lidlplus.com/api/app/v1/{country}/store/{storeId}/categories
```

Header:

```text
Accept-Language: es
```

---

## Productos de categoría

```http
GET https://product-catalog.lidlplus.com/api/app/v1/{country}/store/{storeId}/categories/{categoryId}/products
```

Parámetros:

```text
skip
limit
date
```

---

## Subcategorías

```http
GET https://product-catalog.lidlplus.com/api/app/v1/{country}/store/{storeId}/categories/{categoryId}/categories
```

---

## Productos de subcategoría

```http
GET https://product-catalog.lidlplus.com/api/app/v1/{country}/store/{storeId}/categories/{categoryId}/categories/{subcategoryId}/products
```

Parámetros:

```text
skip
limit
date
```

---

## Producto concreto

```http
GET https://product-catalog.lidlplus.com/api/app/v1/{country}/store/{storeId}/products/{productId}
```

Parámetros:

```text
date
```

---

## Buscar productos

```http
GET https://product-catalog.lidlplus.com/api/app/v1/{country}/store/{storeId}/search
```

Parámetros:

```text
q
date
```

---

# 35. Modelo recomendado para importar en el proyecto

Una versión simplificada podría ser:

```json
{
  "source": "lidl",
  "source_product_id": "8807458416491_ES",
  "store_id": "ES0549",
  "name": "Baguetina",
  "brand": null,
  "category": "Pan y Bollería",
  "subcategory": null,
  "image_url": "https://...",
  "price": 0.29,
  "currency": "EUR",
  "package_text": "100g",
  "unit_price_text": "1kg = 2.90",
  "stock_status": "Available",
  "product_line": "Food",
  "listing_type": "Assortment",
  "click_and_collect": true,
  "age_limit": null
}
```

Campos especialmente útiles para **What's in my fridge??**:

```text
source
source_product_id
store_id
name
brand
category
subcategory
image_url
price
currency
package_text
stock_status
```

---

# 36. Recomendación sobre datos variables por tienda

El catálogo se consulta siempre con:

```text
storeId
```

Por tanto, conviene asumir que pueden variar entre tiendas:

```text
precio
stock
disponibilidad
promociones
catálogo
```

No se debe modelar inicialmente el catálogo como si fuera completamente global para toda España.

Una estructura razonable sería separar:

```text
producto base
```

de:

```text
datos por tienda
```

Por ejemplo:

```text
products
product_store_snapshots
stores
```

---

# 37. Posible modelo Supabase

## `stores`

```text
id
source
source_store_id
name
address
locality
postal_code
latitude
longitude
```

## `products`

```text
id
source
source_product_id
name
brand
image_url
product_line
listing_type
age_limit
```

## `product_store_data`

```text
product_id
store_id
price
price_without_deposit
deposit
currency
package_text
unit_price_text
stock_status
click_and_collect
updated_at
```

## `product_categories`

```text
product_id
category
subcategory
```

## `product_promotions`

```text
product_id
store_id
discount_message
price
start_at
end_at
raw_offer
```

---

# 38. Guardar catálogo bruto

Es recomendable conservar también el payload original:

```python
with open(
    "lidl_products.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        all_products,
        f,
        ensure_ascii=False,
        indent=2
    )
```

Ventajas:

- permite reprocesar sin volver a llamar a Lidl;
- evita perder campos nuevos;
- permite depurar normalizaciones;
- sirve como snapshot histórico;
- permite comparar cambios futuros del endpoint.

---

# 39. Script mínimo: buscar tienda y extraer catálogo

```python
import requests
import json

COUNTRY = "ES"
LANGUAGE = "es"

# 1. Buscar tienda
r = requests.get(
    "https://stores.lidlplus.com/api/v1/autocomplete/ES",
    params={
        "input": "Madrid",
        "language": LANGUAGE,
        "latitude": 40.4168,
        "longitude": -3.7038,
    }
)

r.raise_for_status()

stores = r.json()

STORE = stores[0]["storeKey"]

print("STORE:", STORE)


# 2. Cliente catálogo
BASE = "https://product-catalog.lidlplus.com/api/app/v1"

session = requests.Session()

session.headers.update({
    "Accept-Language": LANGUAGE
})


# 3. Categorías
r = session.get(
    f"{BASE}/{COUNTRY}/store/{STORE}/categories"
)

r.raise_for_status()

categories = r.json()["categories"]


# 4. Descargar productos
def get_products(url):
    out = []
    skip = 0
    limit = 100

    while True:
        r = session.get(
            url,
            params={
                "skip": skip,
                "limit": limit
            }
        )

        r.raise_for_status()

        data = r.json()
        batch = data.get("products", [])

        out.extend(batch)

        total = data.get("totalProducts")

        if not batch:
            break

        skip += len(batch)

        if total is not None and skip >= total:
            break

    return out


products = []

for category in categories:
    cid = category["id"]

    if not category["hasSubcategories"]:
        url = (
            f"{BASE}/{COUNTRY}/store/{STORE}"
            f"/categories/{cid}/products"
        )

        batch = get_products(url)

        for p in batch:
            p["_category"] = category["name"]
            p["_subcategory"] = None

        products.extend(batch)

    else:
        r = session.get(
            f"{BASE}/{COUNTRY}/store/{STORE}"
            f"/categories/{cid}/categories"
        )

        r.raise_for_status()

        for sub in r.json()["categories"]:
            url = (
                f"{BASE}/{COUNTRY}/store/{STORE}"
                f"/categories/{cid}"
                f"/categories/{sub['id']}"
                f"/products"
            )

            batch = get_products(url)

            for p in batch:
                p["_category"] = category["name"]
                p["_subcategory"] = sub["name"]

            products.extend(batch)


print("TOTAL:", len(products))

with open("lidl_products.json", "w", encoding="utf-8") as f:
    json.dump(products, f, ensure_ascii=False, indent=2)
```

---

# 40. Estado actual

A fecha de esta investigación:

```text
✓ búsqueda de tiendas funcionando
✓ storeKey obtenido correctamente
✓ categorías funcionando
✓ detección de subcategorías funcionando
✓ paginación funcionando
✓ extracción completa funcionando
✓ imágenes disponibles
✓ precios disponibles
✓ stock disponible
✓ promociones Lidl Plus visibles
✓ cantidades/formato disponibles en annotations
✓ catálogo guardado en JSON
```

Resultado probado:

```text
2257 productos
```

para:

```text
ES0549 — Tirso Molina, Madrid
```

---

# 41. Conclusión

Para obtener el catálogo de Lidl España no es necesario hacer scraping.

El flujo estable descubierto es:

```text
1. Buscar una tienda
   ↓
2. Obtener storeKey
   ↓
3. Consultar categorías
   ↓
4. Resolver subcategorías
   ↓
5. Paginar productos
   ↓
6. Guardar catálogo
```

Servicios:

```text
https://stores.lidlplus.com/
https://product-catalog.lidlplus.com/
```

Header clave:

```text
Accept-Language: es
```

Identificador de tienda:

```text
storeKey
```

Identificador de producto:

```text
id
```

La extracción probada produjo:

```text
2257 productos
```

de una única tienda de Madrid.

Esto deja resuelta la parte de **obtención de productos desde el servidor de Lidl** para futuras implementaciones del proyecto.
