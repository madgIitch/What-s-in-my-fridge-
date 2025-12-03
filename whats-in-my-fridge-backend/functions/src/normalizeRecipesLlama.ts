// whats-in-my-fridge-backend/functions/src/normalizeRecipesLlama.ts  
import * as fs from 'fs';  
import * as path from 'path';  
import axios from 'axios';  
  
// ========== INTERFACES ==========  
  
interface OllamaResponse {  
  model: string;  
  response: string;  
  done: boolean;  
}  
  
interface NormalizedRecipe {  
  id: string;  
  name: string;  
  ingredients: string[];  
  originalIngredientsCount: number;  
}  
  
interface Progress {  
  lastProcessedIndex: number;  
  successCount: number;  
  errorCount: number;  
  startTime: number;  
  processedRecipeIds: Set<string>;  
  normalizedRecipes: NormalizedRecipe[];  
}  
  
// ========== CONFIGURACIÓN ==========  
  
const OLLAMA_URL = 'http://localhost:11434/api/generate';  
const MODEL = 'llama3.1:8b';  
const TIMEOUT = 120000; // 120 segundos  
const BATCH_SIZE = 10; // Procesamiento paralelo conservador  
const SAVE_INTERVAL = 50; // Guardar cada 50 recetas  
  
// ========== VARIABLES GLOBALES ==========  
  
let progress: Progress | null = null;  
const recipesPath = path.join(__dirname, '../data/recipes.json');  
const progressPath = path.join(__dirname, '../data/progress.json');  
  
// ========== FUNCIONES AUXILIARES ==========  
  
/**  
 * Extrae JSON de texto que puede contener contenido adicional  
 * Maneja múltiples formatos de respuesta de Llama  
 */  
function extractJSON(text: string): any {  
  // Intenta parsear directamente  
  try {  
    return JSON.parse(text);  
  } catch (e) {  
    // Busca array JSON en el texto  
    const arrayMatch = text.match(/\[[\s\S]*?\]/);  
    if (arrayMatch) {  
      try {  
        return JSON.parse(arrayMatch[0]);  
      } catch (e2) {  
        // Ignora error y continúa con siguiente fallback  
      }  
    }  
        
    // Busca objeto JSON  
    const objectMatch = text.match(/\{[\s\S]*?\}/);  
    if (objectMatch) {  
      try {  
        return JSON.parse(objectMatch[0]);  
      } catch (e3) {  
        // Ignora error y continúa con siguiente fallback  
      }  
    }  
        
    // Intenta limpiar el texto de caracteres problemáticos  
    const cleaned = text  
      .replace(/```json\s*/g, '')  
      .replace(/```\s*/g, '')  
      .replace(/^\s*[\r\n]/gm, '')  
      .trim();  
        
    try {  
      return JSON.parse(cleaned);  
    } catch (e4) {  
      throw new Error('Formato de respuesta inesperado');  
    }  
  }  
}  
  
/**  
 * Carga el progreso desde progress.json  
 */  
function loadProgress(): Progress {  
  if (fs.existsSync(progressPath)) {  
    const data = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));  
        
    // Convertir array de IDs a Set para búsqueda rápida  
    const processedRecipeIds = new Set<string>(data.processedRecipeIds || []);  
        
    console.log(`\n📂 Progreso anterior encontrado:`);  
    console.log(`   Última receta procesada: ${data.lastProcessedIndex}`);  
    console.log(`   Exitosas: ${data.successCount} | Errores: ${data.errorCount}`);  
    console.log(`   Recetas ya procesadas: ${processedRecipeIds.size}`);  
        
    return {  
      lastProcessedIndex: data.lastProcessedIndex || -1,  
      successCount: data.successCount || 0,  
      errorCount: data.errorCount || 0,  
      startTime: data.startTime || Date.now(),  
      processedRecipeIds,  
      normalizedRecipes: data.normalizedRecipes || [],  
    };  
  }  
      
  return {  
    lastProcessedIndex: -1,  
    successCount: 0,  
    errorCount: 0,  
    startTime: Date.now(),  
    processedRecipeIds: new Set<string>(),  
    normalizedRecipes: [],  
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
    processedRecipeIds: Array.from(progress.processedRecipeIds),  
    normalizedRecipes: progress.normalizedRecipes,  
  };  
      
  fs.writeFileSync(progressPath, JSON.stringify(data, null, 2));  
      
  if (force) {  
    console.log(`\n💾 Progreso guardado forzosamente`);  
  }  
}  
  
/**  
 * Normaliza ingredientes usando Llama 3.1 8B  
 * Maneja múltiples formatos de respuesta JSON con fallback robusto  
 */  
async function normalizeIngredientsWithLlama(  
  ingredientsWithMeasures: string[]  
): Promise<string[]> {  
  const prompt = `Extract ONLY the ingredient names (without quantities, measurements, brand names, or preparation instructions) from this list.  
    
Input: ${JSON.stringify(ingredientsWithMeasures)}  
    
Return ONLY a JSON array of ingredient names. Example: ["chicken", "rice", "onion"]  
    
IMPORTANT: Return ONLY the JSON array, no additional text or explanation.`;  
    
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
          'Content-Type': 'application/json',  
        },  
      }  
    );  
    
    const responseText = response.data.response.trim();  
    const parsed = extractJSON(responseText);  
    
    // Validar que sea un array  
    if (Array.isArray(parsed)) {  
      return parsed.filter((item: any) => typeof item === 'string' && item.trim().length > 0);  
    }  
    
    // Si es un objeto con propiedad 'ingredients'  
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.ingredients)) {  
      return parsed.ingredients.filter((item: any) => typeof item === 'string' && item.trim().length > 0);  
    }  
    
    // Si es un objeto con propiedad 'items'  
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {  
      return parsed.items.filter((item: any) => typeof item === 'string' && item.trim().length > 0);  
    }  
    
    throw new Error('Formato de respuesta inesperado');  
  } catch (error: any) {  
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {  
      console.log(`  ⏱️  Timeout: Llama tardó más de ${TIMEOUT / 1000} segundos`);  
    }  
    throw error;  
  }  
}  
  
/**  
 * Procesa todas las recetas con procesamiento paralelo conservador  
 */  
async function processRecipes(): Promise<void> {  
  // Cargar progreso anterior  
  progress = loadProgress();  
      
  // Cargar recetas  
  const recipesData = JSON.parse(fs.readFileSync(recipesPath, 'utf-8'));  
  const recipes = recipesData.recipes;  
  const totalRecipes = recipes.length;  
    
  console.log(`\n📚 Procesando ${totalRecipes} recetas con Llama 3.1 8B (PARALELO CONSERVADOR)...`);  
  console.log(`🚀 Procesando ${BATCH_SIZE} recetas simultáneamente`);  
  console.log(`💾 Guardando progreso cada ${SAVE_INTERVAL} recetas`);  
    
  // Determinar desde dónde reanudar  
  const startIndex = progress!.processedRecipeIds.size;  
  console.log(`\n▶️  Reanudando desde receta ${startIndex + 1}/${totalRecipes}\n`);  
    
  // Procesar en batches paralelos  
  for (let i = startIndex; i < totalRecipes; i += BATCH_SIZE) {  
    const batch = recipes.slice(i, Math.min(i + BATCH_SIZE, totalRecipes));  
        
    // Procesar batch en paralelo  
    await Promise.all(batch.map(async (recipe: any, idx: number) => {  
      const globalIndex = i + idx;  
      const recipeId = recipe.id;  
          
      // Saltar si ya fue procesada  
      if (progress!.processedRecipeIds.has(recipeId)) {  
        return;  
      }  
          
      console.log(`[${globalIndex + 1}/${totalRecipes}] ${recipe.name}`);  
          
      try {  
        const normalized = await normalizeIngredientsWithLlama(recipe.ingredientsWithMeasures || []);  
        const originalCount = recipe.ingredientsWithMeasures?.length || 0;  
        const extractedLength = normalized.length;  
            
        console.log(`  ✅ ${extractedLength}/${originalCount} ingredientes extraídos`);  
            
        // Actualizar receta en el array principal  
        recipe.ingredients = normalized;  
            
        // Guardar en progress.normalizedRecipes  
        const normalizedRecipe: NormalizedRecipe = {  
          id: recipeId,  
          name: recipe.name,  
          ingredients: normalized,  
          originalIngredientsCount: originalCount,  
        };  
            
        progress!.normalizedRecipes.push(normalizedRecipe);  
        progress!.processedRecipeIds.add(recipeId);  
        progress!.successCount++;  
        progress!.lastProcessedIndex = globalIndex;  
      } catch (error: any) {  
        console.log(`  ❌ Error: ${error.message}`);  
        progress!.errorCount++;  
      }  
    }));  
        
    // Guardar progreso cada SAVE_INTERVAL recetas  
    if ((i + BATCH_SIZE) % SAVE_INTERVAL === 0 || i + BATCH_SIZE >= totalRecipes) {  
      saveProgress();  
          
      const elapsed = ((Date.now() - progress!.startTime) / 1000 / 60).toFixed(1);  
      const rate = ((progress!.successCount) / (Date.now() - progress!.startTime) * 1000 * 60).toFixed(1);  
      const remaining = totalRecipes - progress!.successCount - progress!.errorCount;  
      const eta = (remaining / parseFloat(rate)).toFixed(1);  
          
      console.log(`\n💾 Progreso guardado: ${progress!.successCount + progress!.errorCount}/${totalRecipes}`);  
      console.log(`   ✅ Exitosas: ${progress!.successCount} | ❌ Errores: ${progress!.errorCount}`);  
      console.log(`   ⏱️  Tiempo: ${elapsed}min | Velocidad: ${rate} recetas/min | ETA: ${eta}min`);  
      console.log(`   📊 Tasa de éxito: ${((progress!.successCount / (progress!.successCount + progress!.errorCount)) * 100).toFixed(1)}%\n`);  
    }  
        
    // Pequeña pausa entre batches para no saturar Ollama  
    await new Promise(resolve => setTimeout(resolve, 100));  
  }  
      
  // Aplicar ingredientes normalizados desde progress.json a recipes.json  
  console.log(`\n🔄 Aplicando ingredientes normalizados a recipes.json...`);  
      
  for (const normalizedRecipe of progress!.normalizedRecipes) {  
    const recipe = recipes.find((r: any) => r.id === normalizedRecipe.id);  
    if (recipe) {  
      // PRESERVAR ingredientsWithMeasures y AGREGAR ingredients normalizado  
      recipe.ingredients = normalizedRecipe.ingredients;  
      // No eliminar recipe.ingredientsWithMeasures - se mantiene intacto  
    }  
  }  
      
  // Guardar recipes.json actualizado con ambos campos  
  fs.writeFileSync(recipesPath, JSON.stringify(recipesData, null, 2));  
      
  const totalTime = ((Date.now() - progress!.startTime) / 1000 / 60).toFixed(1);  
  const totalHours = (parseFloat(totalTime) / 60).toFixed(1);  
  console.log(`\n✅ Proceso completado en ${totalTime} minutos (${totalHours} horas)!`);  
  console.log(`   Total exitosas: ${progress!.successCount}`);  
  console.log(`   Total errores: ${progress!.errorCount}`);  
  console.log(`   Tasa de éxito: ${((progress!.successCount / totalRecipes) * 100).toFixed(1)}%`);  
}  
  
// ========== MANEJO DE SEÑALES ==========  
  
// Guardar progreso al recibir Ctrl+C  
process.on('SIGINT', () => {  
  console.log('\n\n⚠️  Interrupción detectada (Ctrl+C)');  
  console.log('💾 Guardando progreso antes de salir...');  
  saveProgress(true);  
  process.exit(0);  
});  
  
// Guardar progreso al recibir señal de terminación  
process.on('SIGTERM', () => {  
  console.log('\n\n⚠️  Señal de terminación recibida');  
  console.log('💾 Guardando progreso antes de salir...');  
  saveProgress(true);  
  process.exit(0);  
});  
  
// ========== EJECUCIÓN ==========  
  
if (require.main === module) {  
  processRecipes().catch(error => {  
    console.error('\n❌ Error fatal:', error);  
    saveProgress(true);  
    process.exit(1);  
  });  
}  
  
export { normalizeIngredientsWithLlama, processRecipes };