# Guía: Aplicar Ingredientes Normalizados a Recetas

## ¿Qué hace este script?

Toma el archivo `normalized-ingredients.json` (generado por el script de normalización) y agrega el campo `ingredientsNormalized` a cada receta en `recipes.json`.

## Proceso

### Paso 1: Aplicar ingredientes normalizados

Ejecuta:
```cmd
.\apply-normalized.bat
```

O directamente:
```cmd
npx ts-node src/applyNormalizedIngredients.ts
```

Esto creará:
- **`data/recipes-with-normalized.json`** - Recetas con el nuevo campo `ingredientsNormalized`
- **`data/ingredients-not-found.json`** - Lista de ingredientes que no se pudieron normalizar

### Paso 2: Revisar resultados

El script mostrará estadísticas como:
```
📊 Estadísticas:
   Total de recetas: 39759
   Recetas con ingredientsNormalized: 38500 (96.8%)
   Total de ingredientes: 245000
   Ingredientes normalizados: 220000 (89.8%)
   Ingredientes sin normalización: 25000 (10.2%)
   Ingredientes únicos sin normalización: 15000
```

### Paso 3: Reemplazar recipes.json original (OPCIONAL)

**⚠️ ADVERTENCIA**: Esto reemplazará tu archivo `recipes.json` original.

Ejecuta:
```cmd
.\replace-recipes.bat
```

Esto creará un backup automáticamente en `data/recipes.json.backup`.

## Estructura de datos resultante

### Antes (recipes.json original)
```json
{
  "recipes": [
    {
      "id": "pasta-carbonara",
      "name": "Pasta Carbonara",
      "ingredients": [
        "spaghetti pasta",
        "bacon strips",
        "parmesan cheese",
        "eggs",
        "black pepper"
      ],
      "ingredientsWithMeasures": [
        "1 lb spaghetti pasta",
        "6 strips bacon",
        "1 cup parmesan cheese",
        "2 eggs",
        "1 tsp black pepper"
      ]
    }
  ]
}
```

### Después (con ingredientsNormalized)
```json
{
  "recipes": [
    {
      "id": "pasta-carbonara",
      "name": "Pasta Carbonara",
      "ingredients": [
        "spaghetti pasta",
        "bacon strips",
        "parmesan cheese",
        "eggs",
        "black pepper"
      ],
      "ingredientsWithMeasures": [
        "1 lb spaghetti pasta",
        "6 strips bacon",
        "1 cup parmesan cheese",
        "2 eggs",
        "1 tsp black pepper"
      ],
      "ingredientsNormalized": [
        "pasta",
        "bacon",
        "cheese",
        "egg",
        "pepper"
      ]
    }
  ]
}
```

## Lógica de normalización

El script usa 3 estrategias para mapear ingredientes:

### 1. Búsqueda directa
```
"salt" → busca en normalized-ingredients.json["salt"] → "salt"
```

### 2. Búsqueda en sinónimos
```
"champiñón" → busca en synonyms de "mushroom" → "mushroom"
```

### 3. Búsqueda parcial
```
"grated parmesan cheese" → contiene "cheese" → "cheese"
```

### 4. Sin match
```
"Brand X Special Sauce" → no encuentra → null (no se agrega)
```

## Ingredientes no encontrados

Los ingredientes que no se puedan normalizar se guardarán en:
```
data/ingredients-not-found.json
```

Esto incluye:
- Ingredientes muy específicos o raros
- Marcas comerciales desconocidas
- Ingredientes que no estaban en el top 1000 más frecuentes

## Para normalizar más ingredientes

Si hay muchos ingredientes sin normalizar, puedes:

1. **Aumentar TOP_N** en `src/normalizeIngredients.ts`:
   ```typescript
   const TOP_N = 2000; // Normalizar top 2000 en lugar de 1000
   ```

2. **Ejecutar normalización nuevamente**:
   ```cmd
   del data\ingredient-normalization-progress.json
   .\run-normalize.bat
   ```

3. **Volver a aplicar normalizaciones**:
   ```cmd
   .\apply-normalized.bat
   ```

## Restaurar backup

Si algo sale mal, restaura el backup:
```cmd
copy data\recipes.json.backup data\recipes.json
```

## Archivos generados

```
whats-in-my-fridge-backend/functions/data/
├── recipes.json                          ← Original (o actualizado si ejecutaste replace)
├── recipes.json.backup                   ← Backup del original
├── recipes-with-normalized.json          ← Versión con ingredientsNormalized
├── normalized-ingredients.json           ← Vocabulario normalizado
├── ingredients-not-found.json            ← Ingredientes sin normalizar
└── ingredient-normalization-progress.json ← Progreso de normalización
```

## Uso en la app

Una vez que tengas `recipes.json` actualizado con `ingredientsNormalized`, puedes:

1. **Subir a Firebase Storage** o **incluir en el bundle de la app**
2. **Implementar matching** en la Cloud Function `getRecipeSuggestions`:
   ```typescript
   // Normalizar ingredientes del usuario
   const userIngredientsNormalized = await normalizeUserIngredients(userIngredients);

   // Buscar recetas que contengan esos ingredientes
   const matches = recipes.filter(recipe => {
     const commonIngredients = recipe.ingredientsNormalized.filter(
       ing => userIngredientsNormalized.includes(ing)
     );
     return commonIngredients.length >= recipe.minIngredients;
   });
   ```

## Siguiente paso

Una vez aplicados los ingredientes normalizados, el siguiente paso es implementar el **matching de ingredientes escaneados** en la app usando fuzzy logic o embeddings.

Ver: [INGREDIENT_NORMALIZATION_STRATEGY.md](../../INGREDIENT_NORMALIZATION_STRATEGY.md) para más detalles.
