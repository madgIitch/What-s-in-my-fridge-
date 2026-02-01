#!/usr/bin/env node

/**
 * Script to classify ingredients using Ollama
 * This script reads normalized-ingredients.json and adds Spanish category classifications
 */

const fs = require('fs');
const path = require('path');

// Ollama API endpoint
const OLLAMA_API = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.1:8b';

// Spanish food categories
const CATEGORIES = {
  'Lácteos': ['dairy', 'milk', 'cheese', 'yogurt', 'cream'],
  'Carnes': ['meat', 'beef', 'pork', 'lamb', 'poultry', 'chicken', 'turkey'],
  'Pescados': ['fish', 'seafood', 'shellfish', 'salmon', 'tuna'],
  'Frutas': ['fruit', 'apple', 'banana', 'berry', 'citrus'],
  'Verduras': ['vegetable', 'greens', 'root', 'leafy'],
  'Granos': ['grain', 'legume', 'rice', 'pasta', 'bean', 'lentil'],
  'Bebidas': ['beverage', 'drink', 'juice', 'soda', 'tea', 'coffee'],
  'Snacks': ['snack', 'chip', 'cracker'],
  'Condimentos': ['spice', 'herb', 'seasoning', 'condiment'],
  'Aceites': ['oil', 'fat', 'butter'],
  'Harinas': ['flour', 'baking', 'dough'],
  'Huevos': ['egg'],
  'Frutos Secos': ['nut', 'seed', 'almond', 'walnut'],
  'Embutidos': ['sausage', 'deli', 'cold cut', 'ham', 'bacon'],
  'Congelados': ['frozen'],
  'Conservas': ['canned', 'preserved', 'jarred'],
  'Salsas': ['sauce', 'dressing', 'marinade', 'mayo', 'ketchup'],
  'Postres': ['dessert', 'sweet', 'candy', 'chocolate', 'cake'],
  'Pan': ['bread', 'bakery', 'pastry'],
  'Otros': ['other', 'misc']
};

// File paths
const DATA_DIR = path.join(__dirname, '../data');
const INPUT_FILE = path.join(DATA_DIR, 'normalized-ingredients.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'normalized-ingredients-classified.json');
const BACKUP_FILE = path.join(DATA_DIR, `normalized-ingredients-backup-${Date.now()}.json`);

/**
 * Call Ollama API to classify an ingredient
 */
async function classifyWithOllama(ingredientName, currentCategory, currentSubcategory) {
  const prompt = `Clasifica el siguiente ingrediente de comida en UNA de estas categorías españolas:

Categorías disponibles:
- Lácteos: productos lácteos (leche, queso, yogurt, etc.)
- Carnes: carnes rojas y aves
- Pescados: pescados y mariscos
- Frutas: frutas frescas
- Verduras: verduras y hortalizas
- Granos: granos, legumbres, arroz, pasta
- Bebidas: bebidas (jugos, refrescos, té, café)
- Snacks: aperitivos y botanas
- Condimentos: especias, hierbas y condimentos
- Aceites: aceites y grasas
- Harinas: harinas y productos de panadería sin hornear
- Huevos: huevos
- Frutos Secos: nueces y semillas
- Embutidos: embutidos y carnes procesadas
- Congelados: productos congelados
- Conservas: productos enlatados o en conserva
- Salsas: salsas y aderezos
- Postres: postres y dulces
- Pan: pan y productos de panadería
- Otros: otros productos

Ingrediente: "${ingredientName}"
Categoría actual en inglés: "${currentCategory}"
Subcategoría: "${currentSubcategory}"

Responde SOLO con el nombre exacto de UNA categoría española de la lista. No añadas explicaciones.`;

  try {
    const response = await fetch(OLLAMA_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: 0.1, // Low temperature for consistent results
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const classification = data.response.trim();

    // Validate that the response is one of our categories
    const validCategories = Object.keys(CATEGORIES);
    if (validCategories.includes(classification)) {
      return classification;
    }

    // If Ollama didn't return a valid category, use heuristic fallback
    return heuristicClassification(currentCategory, currentSubcategory);
  } catch (error) {
    console.error(`Error calling Ollama for ${ingredientName}:`, error.message);
    // Fallback to heuristic classification
    return heuristicClassification(currentCategory, currentSubcategory);
  }
}

/**
 * Heuristic classification based on existing category
 */
function heuristicClassification(category, subcategory) {
  const categoryLower = (category || '').toLowerCase();
  const subcategoryLower = (subcategory || '').toLowerCase();
  const combined = `${categoryLower} ${subcategoryLower}`;

  for (const [spanishCategory, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(keyword => combined.includes(keyword))) {
      return spanishCategory;
    }
  }

  return 'Otros';
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting ingredient classification...\n');

  // Check if Ollama is available
  try {
    const response = await fetch('http://localhost:11434/api/version');
    if (!response.ok) {
      throw new Error('Ollama not responding');
    }
    console.log('✅ Ollama API is available\n');
  } catch (error) {
    console.error('❌ Error: Ollama is not running or not accessible');
    console.error('Please start Ollama with: ollama serve');
    process.exit(1);
  }

  // Read input file
  console.log(`📖 Reading ${INPUT_FILE}...`);
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

  // Create backup
  console.log(`💾 Creating backup at ${BACKUP_FILE}...`);
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));

  // Process ingredients
  const ingredients = data.ingredients;
  const totalIngredients = Object.keys(ingredients).length;
  let processedCount = 0;
  let useOllama = true;

  console.log(`\n🔍 Processing ${totalIngredients} ingredients...\n`);

  for (const [key, ingredient] of Object.entries(ingredients)) {
    processedCount++;
    const percentage = Math.round((processedCount / totalIngredients) * 100);

    let spanishCategory;

    if (useOllama) {
      try {
        spanishCategory = await classifyWithOllama(
          ingredient.normalized,
          ingredient.category,
          ingredient.subcategory
        );
        process.stdout.write(
          `\r[${percentage}%] ${processedCount}/${totalIngredients} - ${ingredient.normalized} → ${spanishCategory}`
        );
      } catch (error) {
        console.log('\n⚠️  Switching to heuristic classification due to Ollama error');
        useOllama = false;
        spanishCategory = heuristicClassification(ingredient.category, ingredient.subcategory);
      }
    } else {
      spanishCategory = heuristicClassification(ingredient.category, ingredient.subcategory);
      process.stdout.write(
        `\r[${percentage}%] ${processedCount}/${totalIngredients} - ${ingredient.normalized} → ${spanishCategory} (heuristic)`
      );
    }

    // Add Spanish category to ingredient
    ingredient.categorySpanish = spanishCategory;

    // Small delay to avoid overwhelming Ollama
    if (useOllama && processedCount % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n');

  // Update metadata
  data.lastUpdated = new Date().toISOString();
  data.version = '1.1.0';
  data.classificationModel = MODEL;
  data.classificationDate = new Date().toISOString();

  // Write output file
  console.log(`\n💾 Writing results to ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));

  // Statistics
  const categoryCounts = {};
  Object.values(ingredients).forEach(ingredient => {
    const cat = ingredient.categorySpanish;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  console.log('\n📊 Classification Statistics:');
  console.log('─────────────────────────────');
  Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const emoji = Object.keys(CATEGORIES).find(key => key === category);
      console.log(`${emoji || '📦'} ${category.padEnd(20)} ${count}`);
    });

  console.log('\n✅ Classification complete!');
  console.log(`📄 Original file backed up to: ${path.basename(BACKUP_FILE)}`);
  console.log(`📄 Classified file saved to: ${path.basename(OUTPUT_FILE)}`);
  console.log('\n💡 To use the new file, rename it to normalized-ingredients.json');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
