# Catálogos locales para R1

Fuentes buscadas en Descargas por petición del usuario el 28 de septiembre de 2026. Se conservaron los exports JSON encontrados en este repositorio. No se ejecutaron los scrapers ni se importó información a Supabase.

| Archivo en `data/` | Productos | Estado |
| --- | ---: | --- |
| eroski_checkpoint.json | 23.172 | Snapshot parcial de checkpoint en curso |
| eroski_products.json | 0 | Export final vacío |
| eroski_products_raw.json | 0 | Export raw vacío |
| aldi_products.json | 2.123 | Export normalizado; cobertura total sin verificar |
| aldi_products_raw.json | 2.123 | Export raw; cobertura total sin verificar |

Mercadona, DIA, Lidl y Carrefour: documentación y carpetas decompiladas encontradas, pero ningún export de catálogo localizado en la búsqueda de archivos de datos. No se incluyen binarios ni código decompilado como datos de catálogo.

## Reproducibilidad

- [Manifest](local-sources.manifest.json): rutas originales, fecha de copia, tamaño, número de productos y SHA-256 de cada archivo. Las copias se validaron como JSON y contra su checksum.
- El checkpoint original de Eroski sigue cambiando. La copia del repo es fija; no se debe leer el archivo mutable de Descargas durante una ingesta reproducible.
- `captured_at` indica cuándo se copió; no prueba cuándo el retailer publicó o se descargó cada producto. `fetched_at` permanece null sin evidencia.
- Los JSON de `data/` usan Git LFS mediante atributos locales a esa carpeta. El manifest permanece texto normal.

## Contrato de ingesta propuesto

Eroski expone `products` como array, con `id`, `name`, `brand`, `price`, `currency`, `url`, `image_url`, `category`, `source_page` y `metrics_item`. Se observan IDs y nombres presentes y únicos en el snapshot inspeccionado. `id` sirve como identificador del retailer; `name` como nombre comercial. No hay campo barcode a nivel de producto en el snapshot inspeccionado.

`metrics_item.quantity` pertenece a analítica comercial: no representa unidades adquiridas, contenido de un pack ni cantidad disponible. Los nombres no confirman por sí solos un concepto culinario ni una fecha de caducidad.

Aldi expone `products` como array con ID, nombre, marca, imágenes, precios y unidad comercial, entre otros campos. Se conserva por petición del usuario; R1 mantiene los cinco retailers definidos en el spec y no incorpora todavía un sexto adapter.

Importar Eroski requiere dry-run, validación de esquema/hash, upsert por retailer+ID y conservación de provenance. Los exports vacíos no sustituyen un catálogo útil. Para los otros cuatro retailers se valida el contrato canónico con fixtures y se informa fuente ausente hasta disponer de exports reales.

## Estado

Los archivos están conservados. La normalización, los adapters y la ingesta de producción todavía no están implementados ni aprobados: forman parte del spec R1 pendiente de aprobación.
