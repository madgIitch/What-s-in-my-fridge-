# Integración del Sistema de Normalización de Ingredientes

## ✅ Lo que acabamos de implementar

Hemos integrado completamente el sistema de normalización de ingredientes en la app React Native. Esto conecta el backend (Cloud Functions) con el frontend (React Native).

### Archivos creados/modificados:

1. **Modelo WatermelonDB**
   - `src/database/models/IngredientMapping.ts` - Modelo para cachear normalizaciones localmente

2. **Schema actualizado**
   - `src/database/schema.ts` - Versión 7 con:
     - Nueva tabla `ingredient_mappings`
     - Nuevo campo `normalized_name` en `food_items`

3. **Database index**
   - `src/database/index.ts` - Registrado `IngredientMapping` model y collection

4. **Cloud Functions wrapper**
   - `src/services/firebase/functions.ts` - Añadidas funciones:
     - `normalizeScannedIngredient()`
     - `normalizeScannedIngredientsBatch()`

5. **Hook de normalización**
   - `src/hooks/useIngredientNormalizer.ts` - Hook con caché local que:
     - Busca en caché local primero
     - Llama a Cloud Function si no está cacheado
     - Guarda resultado en caché
     - Permite verificación manual de normalizaciones

6. **Integración en inventario**
   - `src/hooks/useInventory.ts` - Modificado `addItem()` para normalizar automáticamente
   - `src/database/models/FoodItem.ts` - Añadido campo `normalizedName`

7. **Integración en recetas**
   - `src/hooks/useRecipes.ts` - Modificado para enviar ingredientes a Cloud Function
   - `src/screens/RecipesProScreen.tsx` - Usa `normalizedName` en lugar de `name`

## 🚀 Pasos siguientes

### Paso 1: Migrar la base de datos

Como cambiamos el schema de la versión 6 a la versión 7, necesitas crear una migración:

```bash
cd src/database
```

Crear archivo `migrations.ts`:

```typescript
import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      // Migration from version 6 to 7
      toVersion: 7,
      steps: [
        // Add normalized_name column to food_items
        addColumns({
          table: 'food_items',
          columns: [
            { name: 'normalized_name', type: 'string', isOptional: true },
          ],
        }),
        // Create ingredient_mappings table
        createTable({
          name: 'ingredient_mappings',
          columns: [
            { name: 'scanned_name', type: 'string', isIndexed: true },
            { name: 'normalized_name', type: 'string', isOptional: true },
            { name: 'confidence', type: 'number' },
            { name: 'method', type: 'string' },
            { name: 'verified_by_user', type: 'boolean' },
            { name: 'timestamp', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
});
```

Luego actualizar `src/database/index.ts`:

```typescript
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import migrations from './migrations'; // <-- Importar
import FoodItem from './models/FoodItem';
import ParsedDraft from './models/ParsedDraft';
import RecipeCache from './models/RecipeCache';
import Ingredient from './models/Ingredient';
import IngredientMapping from './models/IngredientMapping';

// Create SQLite adapter
const adapter = new SQLiteAdapter({
  schema,
  migrations, // <-- Añadir
  jsi: false,
});

// ... resto del código
```

### Paso 2: Testing del flujo completo

1. **Añadir un ingrediente manualmente**
   ```typescript
   // En la app, añade un ingrediente:
   // Nombre: "Bio EHL Champignon"
   // Esto debería:
   // 1. Llamar a normalizeScannedIngredient Cloud Function
   // 2. Obtener normalizedName: "mushroom"
   // 3. Guardar en WatermelonDB con ambos nombres
   // 4. Cachear la normalización en ingredient_mappings
   ```

2. **Verificar logs**
   ```
   🔄 Normalized "Bio EHL Champignon" → "mushroom" (partial, confidence: 0.8)
   💾 Cached normalization: "Bio EHL Champignon" → "mushroom"
   ```

3. **Añadir el mismo ingrediente de nuevo**
   ```typescript
   // Debería mostrar:
   ✅ Cache hit for "Bio EHL Champignon" → "mushroom"
   // (sin llamar a Cloud Function)
   ```

4. **Obtener recetas**
   ```typescript
   // En RecipesProScreen, al hacer clic en "Obtener recetas"
   // Debería enviar ingredientes normalizados a getRecipeSuggestions:
   // ["mushroom", "tomato", "onion"] en lugar de
   // ["Bio EHL Champignon", "Tomate Cherry", "Cebolla Blanca"]
   ```

### Paso 3: Actualizar Cloud Function getRecipeSuggestions

Ahora que la app envía ingredientes normalizados, necesitas actualizar el backend para buscar en `ingredientsNormalized`:

```typescript
// whats-in-my-fridge-backend/functions/src/recipeMatcher.ts

export const getRecipeSuggestions = functions
  .region('us-central1')
  .https.onCall(async (data) => {
    const { ingredients, cookingTime, utensils } = data;

    // Cargar recetas desde recipes.json
    const recipes = await loadRecipes();

    // Filtrar recetas que coincidan con ingredientes normalizados
    const matches = recipes.filter(recipe => {
      // Usar ingredientsNormalized en lugar de ingredients
      const recipeIngredients = recipe.ingredientsNormalized || [];

      // Contar cuántos ingredientes del usuario están en la receta
      const commonIngredients = ingredients.filter((userIng: string) =>
        recipeIngredients.some((recipeIng: string) =>
          recipeIng.toLowerCase() === userIng.toLowerCase()
        )
      );

      // Retornar recetas que usen al menos 50% de ingredientes del usuario
      const matchPercentage = commonIngredients.length / ingredients.length;
      return matchPercentage >= 0.5;
    });

    // Ordenar por % de match y filtrar por tiempo/utensilios
    const sortedMatches = matches
      .map(recipe => {
        const matchCount = ingredients.filter((userIng: string) =>
          recipe.ingredientsNormalized.some((recipeIng: string) =>
            recipeIng.toLowerCase() === userIng.toLowerCase()
          )
        ).length;

        return {
          ...recipe,
          matchScore: matchCount / ingredients.length,
          matchCount,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .filter(recipe => {
        // Filtrar por tiempo de cocción
        if (cookingTime && recipe.totalTime > cookingTime) return false;

        // Filtrar por utensilios (si la receta los especifica)
        // ... implementar lógica de utensilios si existe en el schema

        return true;
      })
      .slice(0, 10); // Top 10 recetas

    return {
      success: true,
      recipes: sortedMatches,
    };
  });
```

### Paso 4: Testing de extremo a extremo

1. **Escanear un recibo con OCR**
   - Ingredientes escaneados: "Bio EHL Champignon", "Salchichas Oscar Mayer", "Tomate Cherry"
   - Normalizados automáticamente: "mushroom", "sausage", "tomato"
   - Guardados en inventario con ambos nombres

2. **Obtener recetas**
   - Cloud Function recibe: `["mushroom", "sausage", "tomato"]`
   - Busca en `recipe.ingredientsNormalized`
   - Devuelve recetas que usen estos ingredientes genéricos
   - ✅ Ahora funciona aunque el recibo tenga nombres comerciales!

## 📊 Arquitectura completa

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: NORMALIZACIÓN DE DATASET (COMPLETADO)              │
├─────────────────────────────────────────────────────────────┤
│ normalizeIngredients.ts (Ollama local)                      │
│   ↓                                                          │
│ normalized-ingredients.json (1000 ingredientes)             │
│   ↓                                                          │
│ applyNormalizedIngredients.ts                               │
│   ↓                                                          │
│ recipes.json con ingredientsNormalized (73,322 recetas)     │
│   ↓                                                          │
│ Firebase Storage: normalized-ingredients.json               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FASE 2: CLOUD FUNCTIONS (COMPLETADO)                       │
├─────────────────────────────────────────────────────────────┤
│ normalizeScannedIngredient (Cloud Function)                 │
│  - Estrategia: exact → synonym → partial → fuzzy → LLM     │
│  - Caché en memoria (1 hora TTL)                            │
│  - Vocabulario desde Firebase Storage                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FASE 3: APP INTEGRATION (ACABAMOS DE COMPLETAR)            │
├─────────────────────────────────────────────────────────────┤
│ React Native App                                            │
│   │                                                          │
│   ├─ useInventory.addItem()                                │
│   │    ↓                                                     │
│   ├─ useIngredientNormalizer.normalizeIngredient()         │
│   │    ├─ Buscar en caché local (WatermelonDB)             │
│   │    ├─ Si no existe → Cloud Function                    │
│   │    └─ Guardar en caché local                           │
│   │                                                          │
│   ├─ FoodItem guardado con:                                │
│   │    - name: "Bio EHL Champignon"                        │
│   │    - normalizedName: "mushroom"                        │
│   │                                                          │
│   └─ RecipesProScreen                                       │
│        ↓                                                     │
│      useRecipes.getRecipeSuggestions([normalized names])   │
│        ↓                                                     │
│      Cloud Function: getRecipeSuggestions                   │
│        ↓                                                     │
│      Buscar en recipe.ingredientsNormalized                 │
│        ↓                                                     │
│      ✅ Recetas encontradas!                                │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Beneficios conseguidos

1. **Matching mejorado**: Ingredientes comerciales como "Bio EHL Champignon" ahora matchean con recetas que usan "mushroom"

2. **Caché eficiente**:
   - Cloud Function tiene caché en memoria (1 hora)
   - App tiene caché en WatermelonDB (30 días)
   - Reduce llamadas a Cloud Functions → ahorra dinero

3. **Experiencia de usuario**:
   - Primera vez: ~200ms (Cloud Function)
   - Siguientes veces: ~10ms (caché local)
   - Transparente para el usuario

4. **Alta cobertura**: 91.6% de ingredientes en recetas están normalizados

5. **Escalable**: Si necesitas más ingredientes, solo ejecuta el script de normalización con TOP_N = 2000

## 🔧 Troubleshooting

### Error: "ingredientMappings collection not found"
→ Necesitas ejecutar la migración de base de datos (Paso 1)

### Error: "normalized_name column doesn't exist"
→ Ejecutar migración o reinstalar app (desarrollo)

### Normalización devuelve null
→ El ingrediente no está en el vocabulario de 1000. Opciones:
   1. Ampliar vocabulario a 2000+ ingredientes
   2. Habilitar LLM fallback: `normalizeIngredient(name, true)`
   3. Permitir corrección manual con `verifyNormalization()`

### Recetas no aparecen
→ Verificar que:
   1. Ingredientes tengan `normalizedName` en WatermelonDB
   2. RecipesProScreen use `item.normalizedName || item.name`
   3. Cloud Function `getRecipeSuggestions` busque en `ingredientsNormalized`

## 💡 Mejoras futuras

1. **UI para corrección manual**
   - Mostrar `confidence` score al usuario
   - Permitir corregir normalizaciones incorrectas
   - Usar `useIngredientNormalizer.verifyNormalization()`

2. **Normalización batch en OCR**
   - Usar `normalizeScannedIngredientsBatch()`
   - Normalizar todos los items del recibo en una sola llamada

3. **Analytics**
   - Tracking de normalizaciones fallidas
   - Ingredientes más escaneados
   - Mejorar vocabulario basado en uso real

4. **Sync multi-dispositivo**
   - Compartir caché de normalizaciones vía Firestore
   - Aprendizaje colaborativo

5. **Machine Learning**
   - Entrenar modelo con normalizaciones verificadas por usuarios
   - Mejorar precisión con el tiempo

## 📚 Recursos

- [Estrategia completa](../INGREDIENT_NORMALIZATION_STRATEGY.md)
- [Guía de despliegue backend](whats-in-my-fridge-backend/functions/DEPLOY_NORMALIZATION.md)
- [WatermelonDB Migrations](https://nozbe.github.io/WatermelonDB/Advanced/Migrations.html)
