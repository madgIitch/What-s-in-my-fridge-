// whats-in-my-fridge-backend/functions/src/applyNormalizedIngredients.ts
import * as fs from "fs";
import * as path from "path";

// ========== INTERFACES ==========

interface NormalizedIngredient {
  normalized: string;
  synonyms: string[];
  category: string;
  subcategory?: string;
  frequency: number;
  embedding: any;
}

interface NormalizedIngredientsData {
  version: string;
  lastUpdated: string;
  model: string;
  totalIngredients: number;
  ingredients: { [key: string]: NormalizedIngredient };
}

interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  ingredientsWithMeasures?: string[];
  ingredientsNormalized?: string[];
  minIngredients?: number;
  instructions?: string[];
}

interface RecipesData {
  recipes: Recipe[];
}

// ========== CONFIGURACIÓN ==========

const recipesPath = path.join(__dirname, "../data/recipes.json");
const normalizedPath = path.join(__dirname, "../data/normalized-ingredients.json");
const outputPath = path.join(__dirname, "../data/recipes-with-normalized.json");

// ========== FUNCIONES ==========

/**
 * Normaliza un ingrediente buscándolo en el vocabulario normalizado
 */
function normalizeIngredient(
  ingredient: string,
  normalizedVocab: { [key: string]: NormalizedIngredient }
): string | null {
  const ingredientLower = ingredient.toLowerCase().trim();

  // 1. Búsqueda directa en el vocabulario
  if (normalizedVocab[ingredientLower]) {
    return normalizedVocab[ingredientLower].normalized;
  }

  // 2. Buscar en los sinónimos de cada ingrediente normalizado
  for (const [, data] of Object.entries(normalizedVocab)) {
    if (data.synonyms.some((syn) => syn.toLowerCase() === ingredientLower)) {
      return data.normalized;
    }
  }

  // 3. Buscar coincidencia parcial (el ingrediente contiene la palabra normalizada)
  for (const [normalized] of Object.entries(normalizedVocab)) {
    if (ingredientLower.includes(normalized.toLowerCase())) {
      return normalized;
    }
  }

  // 4. No se encontró normalización, devolver null
  return null;
}

/**
 * Procesa todas las recetas y agrega ingredientsNormalized
 */
function processRecipes(): void {
  console.log("\n🚀 Aplicando ingredientes normalizados a recipes.json...\n");

  // Cargar vocabulario normalizado
  console.log("📖 Cargando vocabulario normalizado...");
  const normalizedData: NormalizedIngredientsData = JSON.parse(
    fs.readFileSync(normalizedPath, "utf-8")
  );
  console.log(`   ✅ ${normalizedData.totalIngredients} ingredientes normalizados cargados\n`);

  // Cargar recetas
  console.log("📖 Cargando recipes.json...");
  const recipesData: RecipesData = JSON.parse(fs.readFileSync(recipesPath, "utf-8"));
  const recipes = recipesData.recipes;
  console.log(`   ✅ ${recipes.length} recetas cargadas\n`);

  // Estadísticas
  const totalRecipes = recipes.length;
  let recipesWithNormalized = 0;
  let totalIngredients = 0;
  let normalizedCount = 0;
  let notFoundCount = 0;
  const notFoundIngredients = new Set<string>();

  console.log("🔄 Procesando recetas...\n");

  // Procesar cada receta
  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];

    if ((i + 1) % 1000 === 0) {
      console.log(`   Procesadas: ${i + 1}/${totalRecipes}...`);
    }

    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      continue;
    }

    const ingredientsNormalized: string[] = [];

    for (const ingredient of recipe.ingredients) {
      totalIngredients++;

      const normalized = normalizeIngredient(ingredient, normalizedData.ingredients);

      if (normalized) {
        // Solo agregar si no está duplicado
        if (!ingredientsNormalized.includes(normalized)) {
          ingredientsNormalized.push(normalized);
        }
        normalizedCount++;
      } else {
        // No se encontró normalización
        notFoundIngredients.add(ingredient);
        notFoundCount++;
      }
    }

    // Agregar campo ingredientsNormalized a la receta
    if (ingredientsNormalized.length > 0) {
      recipe.ingredientsNormalized = ingredientsNormalized;
      recipesWithNormalized++;
    }
  }

  console.log(`   Procesadas: ${totalRecipes}/${totalRecipes} ✅\n`);

  // Guardar archivo actualizado
  console.log("💾 Guardando recipes-with-normalized.json...");
  fs.writeFileSync(outputPath, JSON.stringify(recipesData, null, 2));
  console.log(`   ✅ Guardado en: ${outputPath}\n`);

  // Mostrar estadísticas
  console.log("📊 Estadísticas:");
  console.log(`   Total de recetas: ${totalRecipes}`);
  console.log(`   Recetas con ingredientsNormalized: ${recipesWithNormalized} (${((recipesWithNormalized / totalRecipes) * 100).toFixed(1)}%)`);
  console.log(`   Total de ingredientes: ${totalIngredients}`);
  console.log(`   Ingredientes normalizados: ${normalizedCount} (${((normalizedCount / totalIngredients) * 100).toFixed(1)}%)`);
  console.log(`   Ingredientes sin normalización: ${notFoundCount} (${((notFoundCount / totalIngredients) * 100).toFixed(1)}%)`);
  console.log(`   Ingredientes únicos sin normalización: ${notFoundIngredients.size}\n`);

  // Guardar lista de ingredientes no encontrados
  if (notFoundIngredients.size > 0) {
    const notFoundPath = path.join(__dirname, "../data/ingredients-not-found.json");
    const notFoundList = Array.from(notFoundIngredients).sort();

    fs.writeFileSync(
      notFoundPath,
      JSON.stringify(
        {
          total: notFoundIngredients.size,
          ingredients: notFoundList,
        },
        null,
        2
      )
    );

    console.log("⚠️  Ingredientes no encontrados guardados en:");
    console.log(`   ${notFoundPath}`);
    console.log("   Estos son ingredientes que no están en el top 1000 más frecuentes\n");

    // Mostrar algunos ejemplos
    console.log("   Ejemplos de ingredientes no encontrados:");
    notFoundList.slice(0, 10).forEach((ing) => {
      console.log(`     - ${ing}`);
    });
    if (notFoundList.length > 10) {
      console.log(`     ... y ${notFoundList.length - 10} más`);
    }
    console.log();
  }

  // Reemplazar recipes.json original (hacer backup primero)
  console.log("🔄 ¿Reemplazar recipes.json original?");
  console.log("   Se creará un backup en recipes.json.backup");
  console.log("   Para aplicar los cambios, ejecuta:");
  console.log("   node scripts/replace-recipes.js\n");

  console.log("✅ Proceso completado!");
}

// ========== EJECUCIÓN ==========

if (require.main === module) {
  processRecipes();
}

export { processRecipes, normalizeIngredient };
