# Guía de Despliegue: Sistema de Normalización de Ingredientes

## ✅ Lo que hemos hecho hasta ahora

1. ✅ Normalizado 1,000 ingredientes más frecuentes con Llama 3.1 8B
2. ✅ Aplicado `ingredientsNormalized` a 73,322 recetas (91.6% de cobertura)
3. ✅ Creado Cloud Functions para normalización híbrida (fuzzy + LLM)

## 📦 Archivos creados

### Backend (Cloud Functions)
- `src/normalizeScannedIngredient.ts` - Cloud Function con estrategia híbrida
- `src/index.ts` - Exporta las nuevas funciones

### Scripts
- `upload-normalized-vocab.bat` - Subir vocabulario a Firebase Storage

### Datos
- `data/normalized-ingredients.json` - Vocabulario normalizado (1,000 ingredientes)
- `data/recipes.json` - Recetas con `ingredientsNormalized`

## 🚀 Pasos de despliegue

### Paso 1: Subir vocabulario normalizado a Firebase Storage

```cmd
firebase login
.\upload-normalized-vocab.bat
```

Esto subirá `normalized-ingredients.json` a:
```
gs://[tu-proyecto].appspot.com/normalized-ingredients.json
```

### Paso 2: Desplegar Cloud Functions

```cmd
cd whats-in-my-fridge-backend\functions
npm run build
firebase deploy --only functions
```

Esto desplegará:
- `normalizeScannedIngredient` - Normaliza un ingrediente
- `normalizeScannedIngredientsBatch` - Normaliza múltiples ingredientes

### Paso 3: Testing de las Cloud Functions

#### Test 1: Normalización simple

```bash
firebase functions:shell
```

```javascript
normalizeScannedIngredient({ingredientName: "Bio EHL Champignon"})
// Resultado esperado:
// {
//   success: true,
//   result: {
//     scannedName: "Bio EHL Champignon",
//     normalizedName: "mushroom",
//     confidence: 0.8,
//     method: "partial"
//   }
// }
```

#### Test 2: Normalización batch

```javascript
normalizeScannedIngredientsBatch({
  ingredients: ["Bio EHL Champignon", "Salchichas Oscar Mayer", "Tomate Cherry"]
})
// Resultado esperado:
// {
//   success: true,
//   results: [
//     { scannedName: "Bio EHL Champignon", normalizedName: "mushroom", confidence: 0.8, method: "partial" },
//     { scannedName: "Salchichas Oscar Mayer", normalizedName: "sausage", confidence: 0.85, method: "partial" },
//     { scannedName: "Tomate Cherry", normalizedName: "tomato", confidence: 0.9, method: "partial" }
//   ]
// }
```

## 🔧 Configuración de Ollama (Opcional)

Si quieres usar el fallback de LLM en producción, necesitas:

### Opción A: Ollama en servidor propio
1. Instalar Ollama en un servidor accesible
2. Configurar variable de entorno en Firebase:
   ```bash
   firebase functions:config:set ollama.url="http://tu-servidor:11434"
   ```

### Opción B: Deshabilitar LLM fallback
En la app, llamar con `useLlmFallback: false`:
```typescript
const result = await functions().httpsCallable('normalizeScannedIngredient')({
  ingredientName: "Bio EHL Champignon",
  useLlmFallback: false
});
```

## 📊 Estrategia de normalización

La Cloud Function usa esta estrategia en cascada:

1. **Exacta** (confidence: 1.0) - Match directo en vocabulario
2. **Sinónimo** (confidence: 0.95) - Match en lista de sinónimos
3. **Parcial** (confidence: 0.8) - El ingrediente contiene la palabra normalizada
4. **Fuzzy** (confidence: 0.5-0.8) - Levenshtein similarity > 0.75
5. **LLM** (confidence: 0.85) - Fallback con Ollama si fuzzy < 0.75
6. **None** (confidence: 0) - No se encontró normalización

## 🔍 Monitoreo

### Logs de Cloud Functions

```bash
firebase functions:log --only normalizeScannedIngredient
```

### Métricas esperadas

- **Tasa de éxito**: 85-95% (dependiendo de calidad de escaneos)
- **Latencia promedio**: 50-200ms (sin LLM), 2-5s (con LLM)
- **Cache hit rate**: 80%+ después de 1 mes de uso

## 🎯 Siguientes pasos

### 1. Implementar en la app (React Native)

Crear hook `useIngredientNormalizer`:

```typescript
// src/hooks/useIngredientNormalizer.ts
export function useIngredientNormalizer() {
  const normalizeIngredient = async (scannedName: string) => {
    // 1. Buscar en caché local (WatermelonDB)
    const cached = await getCachedNormalization(scannedName);
    if (cached) return cached;

    // 2. Llamar a Cloud Function
    const result = await functions()
      .httpsCallable('normalizeScannedIngredient')({
        ingredientName: scannedName,
        useLlmFallback: false // Por ahora sin LLM
      });

    // 3. Guardar en caché
    await cacheNormalization(scannedName, result.data.result);

    return result.data.result;
  };

  return { normalizeIngredient };
}
```

### 2. Crear modelo WatermelonDB

```typescript
// src/database/models/IngredientMapping.ts
@tableSchema({
  name: 'ingredient_mappings',
  columns: [
    { name: 'scanned_name', type: 'string' },
    { name: 'normalized_name', type: 'string' },
    { name: 'confidence', type: 'number' },
    { name: 'method', type: 'string' },
    { name: 'verified_by_user', type: 'boolean' },
    { name: 'timestamp', type: 'number' },
  ]
})
```

### 3. Integrar con OCR

Modificar el flujo de escaneo:

```typescript
// Después del OCR
const scannedItems = await parseReceipt(imageUri);

// Normalizar cada ingrediente
const normalizedItems = await Promise.all(
  scannedItems.map(async (item) => {
    const normalized = await normalizeIngredient(item.name);
    return {
      ...item,
      normalizedName: normalized.normalizedName,
      confidence: normalized.confidence
    };
  })
);

// Guardar en inventario con nombre normalizado
```

### 4. Actualizar getRecipeSuggestions

Modificar Cloud Function para usar `ingredientsNormalized`:

```typescript
// src/recipeMatcher.ts
export const getRecipeSuggestions = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const { cookingTime, utensils } = data;

    // Obtener ingredientes normalizados del usuario
    const userIngredients = await getUserNormalizedIngredients(context.auth.uid);

    // Buscar recetas que coincidan
    const matches = recipes.filter(recipe => {
      const commonIngredients = recipe.ingredientsNormalized.filter(
        ing => userIngredients.includes(ing)
      );
      return commonIngredients.length >= recipe.minIngredients;
    });

    return { success: true, recipes: matches };
  });
```

## 💡 Optimizaciones futuras

1. **Embeddings vectoriales** - Para mejor matching semántico
2. **Machine Learning** - Entrenar modelo con datos de usuarios
3. **Corrección colaborativa** - Permitir usuarios corregir normalizaciones
4. **Caché en Firestore** - Para normalizaciones comunes compartidas
5. **Análisis de marcas** - Detectar marcas automáticamente

## 📚 Recursos

- [INGREDIENT_NORMALIZATION_STRATEGY.md](../../INGREDIENT_NORMALIZATION_STRATEGY.md) - Estrategia completa
- [QUICKSTART_NORMALIZATION.md](QUICKSTART_NORMALIZATION.md) - Guía de normalización con Ollama
- [APPLY_NORMALIZED_GUIDE.md](APPLY_NORMALIZED_GUIDE.md) - Guía de aplicación a recetas

## 🆘 Troubleshooting

### Error: "Storage object not found"
→ Asegúrate de haber subido `normalized-ingredients.json` a Storage

### Error: "Timeout"
→ Aumenta timeout de Cloud Function o deshabilita LLM fallback

### Normalización incorrecta
→ Revisa logs para ver qué método se usó y ajusta umbrales de confianza

### Baja tasa de éxito
→ Considera aumentar TOP_N a 2000 o 5000 ingredientes
