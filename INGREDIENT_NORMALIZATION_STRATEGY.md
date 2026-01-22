# Estrategia de Normalización de Ingredientes

## Problema

Existe un **desajuste semántico** entre dos fuentes de datos:

### 1. Ingredientes escaneados del usuario
Nombres comerciales específicos de supermercado:
- Ejemplo: `"Bio EHL Champignon"`, `"Salchichas Oscar Mayer"`
- Son nombres de productos reales con marcas, descripciones, variantes

### 2. Ingredientes en las recetas
Nombres genéricos o semi-específicos:
- Ejemplo: `"mushrooms"`, `"sausage"`, `"Andouille Dinner Sausage"`
- Algunos son muy genéricos, otros tienen marcas específicas

**Resultado**: Cuando comparas `"Bio EHL Champignon"` con la lista de ingredientes de recetas, no encuentra match con `"mushrooms"`, aunque claramente son lo mismo.

---

## Propuesta Original

### Fase 1: Normalización del dataset de recetas

1. **Extraer todos los ingredientes únicos** del campo `ingredients` de todas las recetas en `recipes.json`

2. **Usar un LLM** (Claude, GPT, o modelo local) para normalizar cada ingrediente a su forma más genérica:
   - `"Andouille Dinner Sausage"` → `"sausage"`
   - `"JELL-O Cherry Flavor Gelatin"` → `"gelatin"`
   - `"BAKER'S Semi-Sweet Chocolate"` → `"chocolate"`
   - `"frozen pound cake"` → `"cake"`

3. **Agregar nuevo campo** `ingredientsNormalized` a cada receta:
   ```json
   {
     "id": "1-1-2-3-jambalaya",
     "name": "1-2-3 Jambalaya",
     "ingredients": [
       "Andouille Dinner Sausage",
       "raw shrimp",
       "boneless, skinless chicken breast"
     ],
     "ingredientsNormalized": [
       "sausage",
       "shrimp",
       "chicken"
     ]
   }
   ```

4. **Extraer vocabulario global**: Conjunto único de todos los ingredientes normalizados

### Fase 2: Matching con fuzzy logic

1. **Normalización inicial** del ingrediente escaneado
2. **Fuzzy matching**: Usar algoritmo de similitud de texto (Levenshtein, Jaro-Winkler)
3. **Asignación**: Mapear ingrediente escaneado a ingrediente normalizado
4. **Comparación**: Comparar ingredientes normalizados del usuario con `ingredientsNormalized` de recetas

---

## Mejoras Propuestas

### 1. Normalización en Dos Niveles

En lugar de solo `ingredientsNormalized`, usar:

```json
{
  "ingredients": ["Andouille Dinner Sausage", "raw shrimp"],
  "ingredientsNormalized": ["sausage", "shrimp"],
  "ingredientsSynonyms": [
    ["sausage", "salchicha", "chorizo", "embutido"],
    ["shrimp", "gamba", "camarón", "langostino"]
  ]
}
```

**Ventaja**: El fuzzy matching solo con strings es limitado. Los sinónimos capturan equivalencias semánticas que no tienen similitud textual.

---

### 2. Embeddings Vectoriales > Fuzzy Matching Puro

El fuzzy matching (Levenshtein, etc.) solo funciona con similitud de caracteres. **Problemas**:
- Sinónimos: `"mushroom"` vs `"champiñón"` (0% similitud de texto, pero 100% similitud semántica)
- Plurales y variantes: `"tomatoes"` vs `"tomate"`
- Descripciones: `"Bio EHL Champignon"` vs `"mushroom"`

#### Alternativa: Embeddings Vectoriales

```typescript
// Generas embeddings una vez para todo el vocabulario normalizado
const vocabEmbeddings = {
  "mushroom": [0.12, 0.45, -0.23, ...],  // Vector de 384 dimensiones
  "sausage": [0.33, -0.12, 0.56, ...],
  // ...
}

// Cuando escaneas "Bio EHL Champignon"
const scannedEmbedding = generateEmbedding("Bio EHL Champignon");

// Buscas el más similar por cosine similarity
const bestMatch = findMostSimilar(scannedEmbedding, vocabEmbeddings);
// → "mushroom" (score: 0.87)
```

**Ventajas**:
- Captura similitud semántica, no solo léxica
- Funciona entre idiomas si usas modelos multilingües
- Más robusto con marcas y descripciones

**Modelos sugeridos**:
- `sentence-transformers/all-MiniLM-L6-v2` (ligero, 384 dimensiones)
- `multilingual-e5-small` (español + inglés)

---

### 3. Estrategia Híbrida: LLM + Embeddings + Fuzzy

Pipeline en cascada:

```
Ingrediente escaneado: "Bio EHL Champignon"
         ↓
[1. Fuzzy exacto] → Si score > 0.9 → Match directo
         ↓ (no match)
[2. Embeddings] → Si score > 0.75 → Match con confianza
         ↓ (no match o baja confianza)
[3. LLM fallback] → Pregunta al LLM: "¿Qué ingrediente genérico es 'Bio EHL Champignon'?"
         ↓
    Cache la respuesta para futuros usos
```

**Ventajas**:
- Fuzzy es rápido y cubre casos obvios
- Embeddings cubren el 95% de casos con buena precisión
- LLM solo para casos difíciles (costoso pero preciso)

---

### 4. Caché de Normalizaciones de Usuarios

Crear tabla en WatermelonDB:

```typescript
// ingredient_mappings table
{
  scannedName: "Bio EHL Champignon",
  normalizedName: "mushroom",
  confidence: 0.92,
  source: "embedding", // o "llm" o "fuzzy"
  verifiedByUser: false, // Permite corrección manual
  timestamp: 1737449200000
}
```

**Ventajas**:
1. No normalizar el mismo producto dos veces
2. Mejora con el tiempo (crowdsourced de usuarios)
3. Permite corrección manual: "No, esto no es 'mushroom', es 'truffle'"

---

### 5. Normalización Incremental vs Batch Completo

#### Opción A (Batch completo)
Script que procesa 108MB de recetas de una vez
- **Pros**: Todo listo de inmediato
- **Contras**: Costoso en tokens de LLM, toma mucho tiempo, difícil de iterar

#### Opción B (Lazy)
Normalizar bajo demanda
- Solo normalizas ingredientes cuando se usan en búsquedas
- Cacheas el resultado
- Con el tiempo, el 80% más común estará normalizado

#### Opción C (Híbrido - RECOMENDADO)
- Script normaliza el top 500-1000 ingredientes más comunes
- El resto se normaliza lazy cuando se encuentran

---

### 6. Categorización Adicional

Además de normalizar, categorizar:

```json
{
  "ingredient": "sausage",
  "normalized": "sausage",
  "category": "meat",
  "subcategory": "processed_meat",
  "alternativeNames": ["salchicha", "chorizo", "hot dog"],
  "excludedFor": ["vegetarian", "vegan", "kosher"]
}
```

**Permite**:
- Mejor matching (si tienes "chicken", puedes sugerir recetas con "meat")
- Filtros dietéticos
- Sustituciones inteligentes

---

## Recomendación Final: Implementación por Fases

### Fase 1 (Hacer ahora)

1. **Script con LLM** que extrae ingredientes únicos del `recipes.json`
2. **Normaliza solo el top 1000 más frecuentes** (Pareto: probablemente cubren el 80% de casos)
3. **Genera embeddings** para esos 1000 ingredientes
4. **Guarda en archivo** `normalized-ingredients.json`:

```json
{
  "mushroom": {
    "synonyms": ["champiñón", "champignon", "hongos", "setas"],
    "embedding": [0.12, 0.45, -0.23, ...],
    "category": "vegetable",
    "subcategory": "fungi"
  },
  "sausage": {
    "synonyms": ["salchicha", "chorizo", "embutido", "hot dog"],
    "embedding": [0.33, -0.12, 0.56, ...],
    "category": "meat",
    "subcategory": "processed_meat"
  }
}
```

### Fase 2 (Runtime en la app)

1. **Cuando escaneas ingrediente**: Busca en caché local primero (WatermelonDB)
2. **Si no está en caché**: Calcula embedding y busca el más similar
3. **Si confianza < 0.7**: Usa Cloud Function con LLM como fallback
4. **Cachea el resultado** en WatermelonDB para futuros usos

### Fase 3 (Futuro)

- Permite usuarios **corregir matches incorrectos**
- Sincroniza correcciones a Firestore para **mejorar para todos los usuarios**
- **Lazy-normalize** el resto del vocabulario conforme se usa

---

## Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│  Usuario escanea ticket → "Bio EHL Champignon"             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
         ┌───────────────────────────────┐
         │  ¿Existe en caché local?      │
         └───────────┬───────────────────┘
                     ↓
              ┌──────┴──────┐
              │ SÍ          │ NO
              ↓             ↓
     ┌────────────┐   ┌─────────────────────┐
     │ Usar cache │   │ 1. Fuzzy exact      │
     └────────────┘   │    score > 0.9?     │
                      └──────┬──────────────┘
                             ↓
                      ┌─────────────────────┐
                      │ 2. Embedding match  │
                      │    score > 0.75?    │
                      └──────┬──────────────┘
                             ↓
                      ┌─────────────────────┐
                      │ 3. LLM fallback     │
                      │    (Cloud Function) │
                      └──────┬──────────────┘
                             ↓
                      ┌─────────────────────┐
                      │ Cache resultado     │
                      │ (WatermelonDB)      │
                      └──────┬──────────────┘
                             ↓
         ┌───────────────────────────────────┐
         │  Ingrediente normalizado:         │
         │  "mushroom"                       │
         └────────────┬──────────────────────┘
                      ↓
         ┌───────────────────────────────────┐
         │  Compara con recetas usando       │
         │  ingredientsNormalized            │
         └────────────┬──────────────────────┘
                      ↓
         ┌───────────────────────────────────┐
         │  Encuentra recetas con "mushroom" │
         │  Muestra al usuario               │
         └───────────────────────────────────┘
```

---

## Archivos y Estructura de Datos

### `normalized-ingredients.json`
Vocabulario global de ingredientes normalizados con embeddings:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-01-21",
  "ingredients": {
    "mushroom": {
      "normalized": "mushroom",
      "synonyms": ["champiñón", "champignon", "hongos", "setas", "portobello"],
      "embedding": [0.12, 0.45, -0.23, ...],
      "category": "vegetable",
      "subcategory": "fungi",
      "commonBrands": ["Bio EHL", "Carrefour Bio"]
    }
  }
}
```

### WatermelonDB Schema: `ingredient_mappings`

```typescript
@tableSchema({
  name: 'ingredient_mappings',
  columns: [
    { name: 'scanned_name', type: 'string' },
    { name: 'normalized_name', type: 'string' },
    { name: 'confidence', type: 'number' },
    { name: 'source', type: 'string' }, // 'fuzzy' | 'embedding' | 'llm'
    { name: 'verified_by_user', type: 'boolean' },
    { name: 'timestamp', type: 'number' },
  ]
})
```

### Cloud Function: `normalizeIngredient`

```typescript
export const normalizeIngredient = functions.https.onCall(async (data) => {
  const { ingredientName } = data;

  // Usa LLM para normalizar
  const normalized = await llm.normalize(ingredientName);

  return {
    success: true,
    normalized,
    confidence: 0.95
  };
});
```

---

## Herramientas y Librerías Sugeridas

### Para el script de normalización (Node.js)
- **LLM**: `@anthropic-ai/sdk` (Claude) o `openai`
- **Embeddings**: `@xenova/transformers` (ejecuta modelos en Node.js)
- **Procesamiento de JSON**: `fs/promises`, `stream` para archivos grandes

### Para la app (React Native)
- **Embeddings locales**: `@xenova/transformers` o `onnxruntime-react-native`
- **Similitud vectorial**: `ml-distance` o implementación custom de cosine similarity
- **Fuzzy matching**: `fuse.js` o `string-similarity`

---

## Estimación de Costos

### Fase 1 (Script de normalización)

**Escenario**: 108MB de recetas, ~10,000 ingredientes únicos

#### Opción A: Normalizar todo
- Tokens input: ~10,000 ingredientes × 20 tokens = 200K tokens
- Tokens output: ~10,000 ingredientes × 10 tokens = 100K tokens
- Costo Claude Haiku: ~$0.15 USD
- Tiempo: ~30 minutos

#### Opción B: Top 1000 (RECOMENDADO)
- Tokens input: ~1,000 ingredientes × 20 tokens = 20K tokens
- Tokens output: ~1,000 ingredientes × 10 tokens = 10K tokens
- Costo Claude Haiku: ~$0.015 USD
- Tiempo: ~3 minutos

### Fase 2 (Runtime)

**Por usuario activo/mes**:
- Escaneos promedio: 20 ingredientes
- Cache hit rate: 70% (después de 1 mes)
- LLM fallback: 6 ingredientes × 30 tokens = 180 tokens
- Costo: ~$0.001 USD/usuario/mes

---

## Próximos Pasos

1. **Decidir enfoque**: ¿Normalización completa o incremental?
2. **Crear script** de normalización con LLM
3. **Generar embeddings** para vocabulario normalizado
4. **Implementar caché** en WatermelonDB
5. **Crear Cloud Function** para fallback de LLM
6. **Implementar matching** en la app con estrategia híbrida
7. **Testing** con ingredientes reales escaneados

---

## Notas Adicionales

- **Idioma**: Considerar que las recetas están en inglés pero los escaneos pueden ser en español
- **Multilingüe**: Los embeddings multilingües son esenciales
- **Actualización**: El vocabulario normalizado debe ser versionado y actualizable
- **Feedback loop**: Implementar sistema de corrección de usuarios para mejorar con el tiempo
