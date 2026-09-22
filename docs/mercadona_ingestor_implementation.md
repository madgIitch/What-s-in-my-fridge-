# Mercadona Catalog Ingestor — Implementation Notes

## Objetivo

Implementar en **What's in my fridge??** un ingestor periódico del catálogo de productos de alimentación de Mercadona, similar al ingestor de FAB, pero adaptado a la API pública que utiliza la app de Mercadona.

La idea es ejecutar un **cron job una vez por semana** dentro de un contenedor, descargar el catálogo disponible, deduplicarlo, detectar productos nuevos o retirados y sincronizarlo con Supabase.

---

# 1. Hallazgos principales

## 1.1. Base URL

La app de Mercadona utiliza como base:

```text
https://tienda.mercadona.es/api/
```

Los endpoints relevantes detectados son:

```text
GET /api/categories/
GET /api/categories/{id}/
GET /api/products/{id}/
```

También aparecen endpoints relacionados con código postal / tienda:

```text
GET /api/postal-codes/actions/retrieve-pc/{postal_code}/
GET /api/postal-codes/actions/retrieve-shops/{postal_code}/
PUT /api/postal-codes/actions/change-pc/
```

Y endpoints autenticados para usuarios, incluyendo renovación de token:

```text
POST /api/auth/tokens/
```

---

# 2. Autenticación

## 2.1. El catálogo no requiere login

Se ha probado directamente:

```text
GET https://tienda.mercadona.es/api/categories/?lang=es
```

Resultado:

```text
HTTP 200
```

Por tanto, para consultar el catálogo básico:

- no hace falta `Authorization: Bearer ...`
- no hace falta `access_token`
- no hace falta `refresh_token`
- no hace falta registrar un dispositivo
- no hace falta iniciar sesión con una cuenta de Mercadona

Esto simplifica mucho el diseño respecto al ingestor de FAB.

---

## 2.2. Sistema de tokens de Mercadona

La app sí implementa:

```text
access_token
refresh_token
```

y dispone de:

```text
POST /api/auth/tokens/
```

con un body similar a:

```json
{
  "refresh_token": "..."
}
```

pero estos tokens se utilizan para funcionalidades de usuario autenticado, como:

- perfil
- carrito
- pedidos
- direcciones
- métodos de pago
- sesión de cliente

Para el ingestor de catálogo **no deben utilizarse**.

---

# 3. Estructura del catálogo

## 3.1. Categorías principales

Petición:

```http
GET /api/categories/?lang=es
```

Ejemplo de respuesta:

```json
{
  "count": 26,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 12,
      "name": "Aceite, especias y salsas",
      "categories": [
        {
          "id": 112,
          "name": "Aceite, vinagre y sal"
        }
      ]
    }
  ]
}
```

La respuesta inicial devuelve:

```text
categoría principal
    ↓
subcategorías
```

Ejemplo:

```text
Aceite, especias y salsas
├── 112 Aceite, vinagre y sal
├── 115 Especias
├── 116 Mayonesa, ketchup y mostaza
└── 117 Otras salsas
```

---

## 3.2. Productos por categoría

Petición probada:

```http
GET /api/categories/112/?lang=es
```

Resultado:

```text
HTTP 200
```

La respuesta tiene otro nivel de agrupación:

```text
categoría 112
    ↓
subcategorías internas
    ↓
products[]
```

Ejemplo:

```json
{
  "id": 112,
  "name": "Aceite, vinagre y sal",
  "categories": [
    {
      "id": 420,
      "name": "Aceite de oliva",
      "products": [
        {
          "id": "4241",
          "display_name": "Aceite de oliva 0,4º Hacendado",
          "packaging": "Garrafa",
          "published": true,
          "thumbnail": "...",
          "share_url": "...",
          "price_instructions": {
            "unit_size": 5.0,
            "size_format": "l",
            "unit_price": "17.25",
            "bulk_price": "3.45",
            "reference_price": "3.450",
            "reference_format": "L",
            "tax_percentage": "4.000"
          }
        }
      ]
    }
  ]
}
```

---

# 4. Datos disponibles sin consultar cada producto individual

Cada entrada dentro de `products[]` ya incluye una cantidad bastante completa de información:

```text
id
slug
display_name
packaging
published
status
thumbnail
share_url
main_feature
badges
price_instructions
unavailable_from
unavailable_weekdays
is_new_arrival
```

Dentro de `price_instructions` aparecen campos como:

```text
unit_size
size_format
unit_price
bulk_price
reference_price
reference_format
tax_percentage
previous_unit_price
selling_method
unit_selector
bunch_selector
price_decreased
is_new
is_pack
pack_size
```

Por tanto, para el catálogo semanal **no es necesario hacer una petición por producto**.

---

# 5. Estrategia recomendada de crawling

## 5.1. Flujo principal

```text
cron semanal
    ↓
GET /categories/
    ↓
obtener IDs de categorías intermedias
    ↓
GET /categories/{id}/
    ↓
extraer products[]
    ↓
deduplicar por product.id
    ↓
upsert en Supabase
```

Esto reduce el número de peticiones de miles a unas pocas decenas o centenas.

---

## 5.2. No hacer esto semanalmente

Evitar:

```text
/categories/
→ /categories/{id}/
→ /products/1/
→ /products/2/
→ /products/3/
→ ...
```

Si existen miles de productos, esto multiplicaría innecesariamente el tráfico.

---

## 5.3. Enriquecimiento bajo demanda

El endpoint:

```text
GET /api/products/{id}/
```

debe reservarse para:

- productos nuevos
- productos que necesiten información ampliada
- productos cuyo contenido haya cambiado

Posibles datos extra:

```text
ingredientes
alérgenos
información nutricional
detalles
información de producto
```

### Flujo recomendado

```text
producto detectado
    ↓
¿existe en Supabase?
    ├── no
    │    ↓
    │  insertar
    │    ↓
    │  GET /products/{id}/
    │    ↓
    │  enriquecer
    │
    └── sí
         ↓
       comparar hash
         ↓
       actualizar si cambia
```

---

# 6. Sesión HTTP y cookies

La respuesta del servidor incluye cookies como:

```text
_abck
bm_sz
```

Estas cookies parecen proceder de la infraestructura de protección de Mercadona/Akamai.

No es necesario:

- fabricarlas manualmente
- persistirlas en Supabase
- copiar cookies de navegador
- reutilizarlas entre ejecuciones

Se recomienda utilizar una única `requests.Session()` durante cada ejecución:

```python
import requests

session = requests.Session()

session.headers.update({
    "Accept": "application/json",
})
```

De esta forma, las cookies entregadas por el servidor se reutilizan automáticamente dentro del mismo proceso.

Flujo:

```text
inicio cron
    ↓
crear Session()
    ↓
primera petición
    ↓
servidor envía cookies
    ↓
Session conserva cookies
    ↓
resto del catálogo
    ↓
termina el proceso
```

En la siguiente ejecución semanal se crea una sesión nueva.

---

# 7. Warehouse (`wh`)

La app de Mercadona maneja un parámetro:

```text
wh
```

relacionado con el warehouse / tienda / área geográfica.

Ejemplo:

```text
/api/categories/?lang=es&wh=...
```

Sin embargo, las pruebas realizadas han demostrado que:

```text
/categories/?lang=es
/categories/112/?lang=es
```

funcionan correctamente sin `wh`.

Por tanto, el MVP del ingestor debe comenzar **sin warehouse**.

Solo se implementará `wh` si más adelante se detecta que afecta a:

- disponibilidad
- precios
- surtido
- productos regionales
- stock

---

# 8. Headers

Para las pruebas realizadas ha sido suficiente:

```http
Accept: application/json
```

y:

```text
?lang=es
```

La app también puede utilizar headers como:

```text
Content-Type: application/json
Origin: mercadroid
User-Agent: ...
x-customer-device-id: ...
```

pero no han sido necesarios para las peticiones de catálogo probadas.

Recomendación inicial:

```python
session.headers.update({
    "Accept": "application/json",
})
```

No replicar headers internos de la app salvo que exista una necesidad real.

---

# 9. Rate limiting y política de peticiones

Actualmente no hay evidencia de un `403` o `429` producido por Mercadona en las pruebas realizadas.

Un error observado anteriormente fue:

```text
NameResolutionError
Temporary failure in name resolution
```

Eso era un fallo DNS del entorno y **no una respuesta HTTP del servidor**.

Aun así, el ingestor debe ser conservador.

Configuración recomendada:

```text
workers: 1
concurrency: 1
delay entre requests: 0.8–1.5 s
cron: una vez por semana
```

No es necesario paralelizar.

---

## 9.1. Reintentos

Implementar reintentos para:

```text
429
500
502
503
504
```

Usar backoff exponencial:

```text
2 s
4 s
8 s
16 s
32 s
```

Si existe:

```http
Retry-After
```

respetar ese valor.

Para un:

```text
403
```

no insistir agresivamente. Registrar el error y abortar la ejecución o el bloque actual.

---

# 10. Ejemplo de cliente HTTP

```python
import random
import time
import requests

BASE_URL = "https://tienda.mercadona.es/api"

session = requests.Session()

session.headers.update({
    "Accept": "application/json",
})


def get_json(path: str) -> dict:
    url = f"{BASE_URL}/{path}"

    for attempt in range(5):
        response = session.get(
            url,
            params={"lang": "es"},
            timeout=30,
        )

        if response.status_code == 200:
            return response.json()

        if response.status_code == 403:
            raise RuntimeError(
                f"Mercadona returned 403 for {url}"
            )

        if response.status_code in (429, 500, 502, 503, 504):
            retry_after = response.headers.get("Retry-After")

            if retry_after:
                wait = int(retry_after)
            else:
                wait = 2 ** (attempt + 1)

            time.sleep(wait)
            continue

        response.raise_for_status()

    raise RuntimeError(
        f"Maximum retries reached for {url}"
    )
```

---

# 11. Ejemplo de escaneo completo

```python
import random
import time


def discover_categories():
    data = get_json("categories/")

    result = []

    for root in data["results"]:
        for category in root.get("categories", []):
            result.append({
                "root_id": root["id"],
                "root_name": root["name"],
                "category_id": category["id"],
                "category_name": category["name"],
            })

    return result


def crawl_products():
    categories = discover_categories()

    products = {}

    for category in categories:
        data = get_json(
            f"categories/{category['category_id']}/"
        )

        for child in data.get("categories", []):
            for product in child.get("products", []):
                product_id = product["id"]

                products[product_id] = {
                    **product,

                    "_root_category_id":
                        category["root_id"],

                    "_root_category_name":
                        category["root_name"],

                    "_category_id":
                        category["category_id"],

                    "_category_name":
                        category["category_name"],

                    "_subcategory_id":
                        child["id"],

                    "_subcategory_name":
                        child["name"],
                }

        time.sleep(
            random.uniform(0.8, 1.5)
        )

    return list(products.values())
```

---

# 12. Deduplicación

Los productos deben deduplicarse utilizando:

```text
product.id
```

Ejemplo:

```python
products = {}

for product in incoming_products:
    products[product["id"]] = product
```

No asumir que cada producto aparece exactamente una vez en el árbol de categorías.

---

# 13. Modelo recomendado en Supabase

Tabla base:

```text
mercadona_products
```

Campos sugeridos:

```text
id                      uuid / bigint interno
mercadona_id            text unique not null

name                    text
slug                    text
packaging               text

root_category_id        integer
root_category_name      text

category_id             integer
category_name           text

subcategory_id          integer
subcategory_name        text

thumbnail_url           text
share_url               text

published               boolean
status                  text
is_new_arrival          boolean

unit_size               numeric
size_format             text

unit_price              numeric
bulk_price              numeric
reference_price         numeric
reference_format        text
previous_unit_price     numeric

tax_percentage          numeric

raw_product             jsonb

content_hash            text

first_seen_at           timestamptz
last_seen_at            timestamptz

active                  boolean default true

details_synced_at       timestamptz
raw_details             jsonb
```

---

# 14. Hash de contenido

Para detectar cambios sin actualizar todo indiscriminadamente:

```python
import hashlib
import json


def product_hash(product: dict) -> str:
    relevant = {
        "display_name": product.get("display_name"),
        "packaging": product.get("packaging"),
        "published": product.get("published"),
        "status": product.get("status"),
        "price_instructions":
            product.get("price_instructions"),
    }

    payload = json.dumps(
        relevant,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )

    return hashlib.sha256(
        payload.encode("utf-8")
    ).hexdigest()
```

---

# 15. Estrategia de sincronización

Para cada producto obtenido:

```text
¿mercadona_id existe?
    │
    ├── no
    │    ↓
    │  INSERT
    │  first_seen_at = now()
    │  last_seen_at = now()
    │  active = true
    │
    └── sí
         ↓
       actualizar last_seen_at
         ↓
       comparar content_hash
         │
         ├── igual
         │    ↓
         │  no modificar contenido
         │
         └── distinto
              ↓
            UPDATE
```

---

# 16. Detección de productos retirados

No eliminar productos inmediatamente si desaparecen del catálogo.

Ejemplo:

```text
semana 1:
4241 encontrado
4240 encontrado

semana 2:
4241 encontrado
4240 no encontrado
```

En semana 2:

```text
4240
last_seen_at = semana anterior
active = true
```

Tras 2 o 3 ejecuciones consecutivas sin aparecer:

```text
active = false
```

Esto protege frente a:

- fallos temporales
- categorías incompletas
- respuestas parciales
- problemas de red

---

# 17. Tabla de ejecuciones

Se recomienda registrar cada ejecución:

```text
mercadona_ingestion_runs
```

Campos:

```text
id
started_at
finished_at

status

categories_found
products_found
products_inserted
products_updated
products_unchanged
products_deactivated

requests_total

http_403_count
http_429_count
http_5xx_count

error_message
```

Esto facilitará detectar cambios de comportamiento en la API.

---

# 18. Arquitectura propuesta

```text
Railway / cron
        │
        │ 1 vez por semana
        ▼
mercadona_ingestor
        │
        ├── GET /categories/
        │
        ├── GET /categories/{id}/
        │
        ├── normalización
        │
        ├── deduplicación
        │
        └── hashing
                │
                ▼
             Supabase
                │
        ┌───────┴────────┐
        │                │
 productos nuevos   existentes
        │                │
        ▼                ▼
 /products/{id}/    update last_seen
        │
        ▼
 enriquecimiento
```

---

# 19. Separación recomendada del proyecto

```text
services/
└── mercadona_ingestor/
    ├── Dockerfile
    ├── requirements.txt
    ├── src/
    │   ├── main.py
    │   ├── client.py
    │   ├── crawler.py
    │   ├── normalizer.py
    │   ├── repository.py
    │   ├── hashing.py
    │   └── config.py
    └── tests/
        ├── test_normalizer.py
        ├── test_hashing.py
        └── fixtures/
```

Responsabilidades:

```text
client.py
    conexión HTTP con Mercadona

crawler.py
    recorrido de categorías y productos

normalizer.py
    transforma JSON externo al modelo interno

repository.py
    operaciones con Supabase

hashing.py
    detección de cambios

main.py
    orquestación de una ejecución
```

---

# 20. Variables de entorno

Ejemplo:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

MERCADONA_BASE_URL=https://tienda.mercadona.es/api
MERCADONA_LANG=es

MERCADONA_REQUEST_MIN_DELAY=0.8
MERCADONA_REQUEST_MAX_DELAY=1.5
MERCADONA_MAX_RETRIES=5

MERCADONA_DEACTIVATE_AFTER_MISSED_RUNS=3
```

No deben existir variables de entorno para:

```text
MERCADONA_USERNAME
MERCADONA_PASSWORD
MERCADONA_ACCESS_TOKEN
MERCADONA_REFRESH_TOKEN
```

porque no son necesarias para el catálogo.

---

# 21. Cron

Frecuencia inicial recomendada:

```text
1 vez por semana
```

Ejemplo conceptual:

```cron
0 4 * * 1
```

Es decir:

```text
lunes a las 04:00
```

La hora exacta es indiferente mientras no interfiera con otras tareas.

---

# 22. MVP del ingestor

Primera versión:

```text
1. GET /categories/
2. extraer IDs de categorías
3. GET /categories/{id}/
4. extraer products[]
5. deduplicar
6. normalizar
7. calcular hash
8. upsert en Supabase
9. actualizar last_seen_at
10. registrar ejecución
```

No implementar inicialmente:

```text
login
refresh token
warehouse
paralelismo
proxies
scraping HTML
Playwright
Selenium
cookies persistentes
rotación de IP
```

---

# 23. Segunda fase

Después de estabilizar el catálogo base:

```text
1. probar /products/{id}/
2. identificar información extra útil
3. enriquecer solo productos nuevos
4. almacenar ingredientes
5. almacenar alérgenos
6. almacenar nutrición
7. actualizar detalles si cambia el producto
```

---

# 24. Posible integración con What's in my fridge??

Una vez sincronizado el catálogo:

```text
usuario escribe / escanea:
"aceite de oliva"
        ↓
búsqueda en mercadona_products
        ↓
Aceite de oliva 0,4º Hacendado
        ↓
usuario selecciona
        ↓
producto añadido a la despensa
```

También permitirá utilizar:

```text
nombre normalizado
categoría
formato
cantidad
unidad
imagen
precio
nutrición
ingredientes
```

como información estructurada para:

- inventario
- OCR de tickets
- matching de productos
- sugerencias de recetas
- cálculo nutricional
- histórico de precios

---

# 25. Estado actual de conocimiento

## Confirmado mediante pruebas

```text
GET /api/categories/?lang=es
→ 200

GET /api/categories/112/?lang=es
→ 200
```

Confirmado:

- el catálogo básico es accesible sin autenticación
- `/categories/` devuelve el árbol inicial
- `/categories/{id}/` devuelve productos
- los productos ya incluyen precio, tamaño, imagen y metadatos básicos
- no se necesita `wh` para las pruebas realizadas
- no se necesita token para estas rutas

## Pendiente de verificar

```text
GET /api/products/{id}/?lang=es
```

Objetivo:

- comprobar ingredientes
- comprobar alérgenos
- comprobar nutrición
- decidir qué datos adicionales guardar

También queda pendiente comprobar si:

- los precios varían con `wh`
- el surtido cambia según zona
- existen productos regionales
- el endpoint cambia de comportamiento desde un datacenter / Railway

---

# 26. Principio de diseño

El ingestor debe ser:

```text
simple
lento
idempotente
observable
tolerante a fallos
sin autenticación innecesaria
```

La prioridad no es descargar el catálogo lo más rápido posible, sino mantener una copia fiable con el mínimo número de peticiones.

---

# 27. Resumen final

La solución recomendada es:

```text
cron semanal
        ↓
requests.Session()
        ↓
/categories/
        ↓
/categories/{id}/
        ↓
productos
        ↓
deduplicar por mercadona_id
        ↓
hash
        ↓
upsert Supabase
        ↓
enriquecer únicamente productos nuevos
        ↓
marcar inactivos tras varias ausencias
```

No necesitamos replicar la lógica de autenticación de la app ni mantener tokens.

La principal ventaja respecto al ingestor de FAB es que el catálogo básico se obtiene mediante endpoints HTTP accesibles directamente y con muy pocas peticiones.
