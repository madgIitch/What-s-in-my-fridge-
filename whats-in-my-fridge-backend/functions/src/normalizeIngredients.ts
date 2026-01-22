// whats-in-my-fridge-backend/functions/src/normalizeIngredients.ts
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

// ========== INTERFACES ==========

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

interface IngredientNormalization {
  original: string;
  normalized: string;
  synonyms: string[];
  category: string;
  subcategory?: string;
}

interface Progress {
  lastProcessedIndex: number;
  successCount: number;
  errorCount: number;
  startTime: number;
  processedIngredients: Set<string>;
  normalizations: IngredientNormalization[];
  ingredientFrequency: Map<string, number>;
}

// ========== CONFIGURACIÓN ==========

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "llama3.1:8b"; // Cambia por el modelo que prefieras
const TIMEOUT = 120000; // 120 segundos
const BATCH_SIZE = 20; // Procesar 20 ingredientes por llamada
const SAVE_INTERVAL = 100; // Guardar cada 100 ingredientes
const TOP_N = 1000; // Solo normalizar los top 1000 ingredientes más frecuentes

// ========== VARIABLES GLOBALES ==========

let progress: Progress | null = null;
const recipesPath = path.join(__dirname, "../data/recipes.json");
const progressPath = path.join(__dirname, "../data/ingredient-normalization-progress.json");
const outputPath = path.join(__dirname, "../data/normalized-ingredients.json");

// ========== FUNCIONES AUXILIARES ==========

/**
 * Extrae JSON de texto que puede contener contenido adicional
 */
function extractJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    // Busca array JSON en el texto
    const arrayMatch = text.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (e2) {
        // Ignora
      }
    }

    // Busca objeto JSON
    const objectMatch = text.match(/\{[\s\S]*?\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e3) {
        // Ignora
      }
    }

    // Intenta limpiar el texto
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^\s*[\r\n]/gm, "")
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (e4) {
      throw new Error("Formato de respuesta inesperado");
    }
  }
}

/**
 * Extrae todos los ingredientes únicos de recipes.json con su frecuencia
 */
function extractUniqueIngredients(): Map<string, number> {
  console.log("\n📊 Extrayendo ingredientes únicos del recipes.json...");

  const recipesData = JSON.parse(fs.readFileSync(recipesPath, "utf-8"));
  const recipes = recipesData.recipes;
  const ingredientFrequency = new Map<string, number>();

  for (const recipe of recipes) {
    const ingredients = recipe.ingredients || [];
    for (const ingredient of ingredients) {
      const normalized = ingredient.toLowerCase().trim();
      if (normalized) {
        ingredientFrequency.set(normalized, (ingredientFrequency.get(normalized) || 0) + 1);
      }
    }
  }

  console.log(`   ✅ Encontrados ${ingredientFrequency.size} ingredientes únicos`);

  return ingredientFrequency;
}

/**
 * Obtiene los top N ingredientes más frecuentes
 */
function getTopIngredients(ingredientFrequency: Map<string, number>, topN: number): string[] {
  const sorted = Array.from(ingredientFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([ingredient]) => ingredient);

  console.log(`\n🎯 Top ${topN} ingredientes más frecuentes seleccionados`);
  console.log(`   #1: "${sorted[0]}" (${ingredientFrequency.get(sorted[0])} veces)`);
  console.log(`   #${topN}: "${sorted[topN - 1]}" (${ingredientFrequency.get(sorted[topN - 1])} veces)`);

  return sorted;
}

/**
 * Carga el progreso desde progress.json
 */
function loadProgress(): Progress {
  if (fs.existsSync(progressPath)) {
    const data = JSON.parse(fs.readFileSync(progressPath, "utf-8"));

    const processedIngredients = new Set<string>(data.processedIngredients || []);
    const ingredientFrequency = new Map<string, number>(
      Object.entries(data.ingredientFrequency || {})
    );

    console.log("\n📂 Progreso anterior encontrado:");
    console.log(`   Última posición: ${data.lastProcessedIndex}`);
    console.log(`   Exitosas: ${data.successCount} | Errores: ${data.errorCount}`);
    console.log(`   Ingredientes ya procesados: ${processedIngredients.size}`);

    return {
      lastProcessedIndex: data.lastProcessedIndex || -1,
      successCount: data.successCount || 0,
      errorCount: data.errorCount || 0,
      startTime: data.startTime || Date.now(),
      processedIngredients,
      normalizations: data.normalizations || [],
      ingredientFrequency,
    };
  }

  return {
    lastProcessedIndex: -1,
    successCount: 0,
    errorCount: 0,
    startTime: Date.now(),
    processedIngredients: new Set<string>(),
    normalizations: [],
    ingredientFrequency: new Map<string, number>(),
  };
}

/**
 * Guarda el progreso en progress.json
 */
function saveProgress(force: boolean = false): void {
  if (!progress) return;

  const data = {
    lastProcessedIndex: progress.lastProcessedIndex,
    successCount: progress.successCount,
    errorCount: progress.errorCount,
    startTime: progress.startTime,
    processedIngredients: Array.from(progress.processedIngredients),
    normalizations: progress.normalizations,
    ingredientFrequency: Object.fromEntries(progress.ingredientFrequency),
  };

  fs.writeFileSync(progressPath, JSON.stringify(data, null, 2));

  if (force) {
    console.log("\n💾 Progreso guardado forzosamente");
  }
}

/**
 * Normaliza un batch de ingredientes usando Ollama
 */
async function normalizeIngredientsBatch(
  ingredients: string[]
): Promise<IngredientNormalization[]> {
  const prompt = `You are a food ingredient normalization expert. Normalize the following list of ingredients to their simplest, most generic form.

For each ingredient, provide:
1. "normalized": The most generic, common name (e.g., "Andouille Dinner Sausage" → "sausage")
2. "synonyms": Alternative names in English and Spanish (e.g., ["sausage", "salchicha", "chorizo", "embutido"])
3. "category": Main category (e.g., "meat", "vegetable", "dairy", "grain", "spice", "condiment", "seafood", "fruit", "beverage", "other")
4. "subcategory": More specific category (e.g., "processed_meat", "leafy_green", "soft_cheese")

Ingredients to normalize:
${JSON.stringify(ingredients, null, 2)}

IMPORTANT: Return ONLY a valid JSON array with this exact structure:
[
  {
    "original": "Andouille Dinner Sausage",
    "normalized": "sausage",
    "synonyms": ["sausage", "salchicha", "chorizo", "embutido"],
    "category": "meat",
    "subcategory": "processed_meat"
  }
]

Return the JSON array with no additional text or explanation.`;

  try {
    const response = await axios.post<OllamaResponse>(
      OLLAMA_URL,
      {
        model: MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
        },
      },
      {
        timeout: TIMEOUT,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = response.data.response.trim();
    const parsed = extractJSON(responseText);

    if (!Array.isArray(parsed)) {
      throw new Error("La respuesta no es un array");
    }

    // Validar y limpiar estructura
    const validated: IngredientNormalization[] = [];

    for (const item of parsed) {
      if (item.original && item.normalized) {
        validated.push({
          original: item.original,
          normalized: item.normalized,
          synonyms: Array.isArray(item.synonyms) ? item.synonyms : [item.normalized],
          category: item.category || "other",
          subcategory: item.subcategory,
        });
      }
    }

    if (validated.length === 0) {
      throw new Error("No se pudo validar ningún ingrediente");
    }

    return validated;
  } catch (error: any) {
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      console.log(`  ⏱️  Timeout: Ollama tardó más de ${TIMEOUT / 1000} segundos`);
    }
    throw error;
  }
}

/**
 * Procesa todos los ingredientes en batches
 */
async function processIngredients(): Promise<void> {
  // Cargar o inicializar progreso
  progress = loadProgress();

  // Si no tenemos ingredientFrequency, extraerlos
  if (progress.ingredientFrequency.size === 0) {
    progress.ingredientFrequency = extractUniqueIngredients();
  }

  // Obtener top N ingredientes
  const topIngredients = getTopIngredients(progress.ingredientFrequency, TOP_N);
  const totalIngredients = topIngredients.length;

  console.log(`\n🚀 Procesando ${totalIngredients} ingredientes con ${MODEL}...`);
  console.log(`📦 Procesando ${BATCH_SIZE} ingredientes por batch`);
  console.log(`💾 Guardando progreso cada ${SAVE_INTERVAL} ingredientes`);

  // Determinar desde dónde reanudar
  // Usar el tamaño de processedIngredients como punto de partida real
  const startIndex = progress.processedIngredients.size;
  console.log(`\n▶️  Reanudando desde ingrediente ${startIndex + 1}/${totalIngredients}\n`);

  // Procesar en batches
  for (let i = startIndex; i < totalIngredients; i += BATCH_SIZE) {
    const endIndex = Math.min(i + BATCH_SIZE, totalIngredients);
    const batch = topIngredients.slice(i, endIndex);

    console.log(`\n[${i + 1}-${endIndex}/${totalIngredients}] Procesando batch de ${batch.length} ingredientes...`);

    try {
      const normalizations = await normalizeIngredientsBatch(batch);

      // Agregar normalizaciones al progreso
      for (const normalization of normalizations) {
        progress!.normalizations.push(normalization);
        progress!.processedIngredients.add(normalization.original);
        progress!.successCount++;
      }

      progress!.lastProcessedIndex = endIndex - 1;

      console.log(`  ✅ ${normalizations.length} ingredientes normalizados`);
    } catch (error: any) {
      console.log(`  ❌ Error en batch: ${error.message}`);
      progress!.errorCount += batch.length;

      // Intentar procesar ingredientes uno por uno si falla el batch
      console.log("  🔄 Intentando procesar uno por uno...");

      for (const ingredient of batch) {
        // Saltar si ya fue procesado
        if (progress!.processedIngredients.has(ingredient)) {
          console.log(`    ⏭️  ${ingredient} (ya procesado)`);
          continue;
        }

        try {
          const normalizations = await normalizeIngredientsBatch([ingredient]);
          if (normalizations.length > 0) {
            progress!.normalizations.push(normalizations[0]);
            progress!.processedIngredients.add(ingredient);
            progress!.successCount++;
            console.log(`    ✓ ${ingredient}`);
          }
        } catch (individualError: any) {
          console.log(`    ✗ ${ingredient}: ${individualError.message}`);
          progress!.errorCount++;
        }

        // Pequeña pausa entre llamadas
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      progress!.lastProcessedIndex = endIndex - 1;
    }

    // Guardar progreso periódicamente
    if ((endIndex % SAVE_INTERVAL === 0) || endIndex >= totalIngredients) {
      saveProgress();

      const elapsed = ((Date.now() - progress!.startTime) / 1000 / 60).toFixed(1);
      const processed = progress!.successCount + progress!.errorCount;
      const rate = (processed / (Date.now() - progress!.startTime) * 1000 * 60).toFixed(1);
      const remaining = totalIngredients - processed;
      const eta = (remaining / parseFloat(rate)).toFixed(1);

      console.log(`\n💾 Progreso guardado: ${processed}/${totalIngredients}`);
      console.log(`   ✅ Exitosas: ${progress!.successCount} | ❌ Errores: ${progress!.errorCount}`);
      console.log(`   ⏱️  Tiempo: ${elapsed}min | Velocidad: ${rate} ingredientes/min | ETA: ${eta}min`);
      console.log(`   📊 Tasa de éxito: ${((progress!.successCount / processed) * 100).toFixed(1)}%`);
    }

    // Pausa pequeña entre batches para no saturar Ollama
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Generar archivo final normalized-ingredients.json
  console.log("\n📝 Generando archivo final normalized-ingredients.json...");

  const normalizedData: { [key: string]: any } = {};

  for (const norm of progress!.normalizations) {
    normalizedData[norm.normalized] = {
      normalized: norm.normalized,
      synonyms: norm.synonyms,
      category: norm.category,
      subcategory: norm.subcategory,
      frequency: progress!.ingredientFrequency.get(norm.original) || 0,
      embedding: null,
    };
  }

  const output = {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    model: MODEL,
    totalIngredients: Object.keys(normalizedData).length,
    ingredients: normalizedData,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  const totalTime = ((Date.now() - progress!.startTime) / 1000 / 60).toFixed(1);
  const totalHours = (parseFloat(totalTime) / 60).toFixed(2);

  console.log(`\n✅ Proceso completado en ${totalTime} minutos (${totalHours} horas)!`);
  console.log(`   Total exitosas: ${progress!.successCount}`);
  console.log(`   Total errores: ${progress!.errorCount}`);
  console.log(`   Tasa de éxito: ${((progress!.successCount / totalIngredients) * 100).toFixed(1)}%`);
  console.log(`   Archivo generado: ${outputPath}`);
}

// ========== MANEJO DE SEÑALES ==========

process.on("SIGINT", () => {
  console.log("\n\n⚠️  Interrupción detectada (Ctrl+C)");
  console.log("💾 Guardando progreso antes de salir...");
  saveProgress(true);
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n⚠️  Señal de terminación recibida");
  console.log("💾 Guardando progreso antes de salir...");
  saveProgress(true);
  process.exit(0);
});

// ========== EJECUCIÓN ==========

if (require.main === module) {
  processIngredients().catch((error) => {
    console.error("\n❌ Error fatal:", error);
    saveProgress(true);
    process.exit(1);
  });
}

export { normalizeIngredientsBatch, processIngredients };
