/**
 * Script para extraer acciones de cocina de las recetas usando Ollama
 *
 * Este script lee el archivo recipes-with-normalized.json y usa Ollama
 * para analizar las instrucciones y extraer todas las acciones principales
 * de cocina que se pueden usar para crear animaciones de Neverito.
 *
 * Características:
 * - ✅ Guarda progreso automáticamente
 * - ✅ Puede retomarse si se interrumpe (Ctrl+C)
 * - ✅ Procesamiento por lotes
 *
 * Requisitos:
 * - Ollama debe estar instalado y corriendo (https://ollama.ai)
 * - Modelos disponibles: llama3.1:8b, qwen2.5-coder:7b-instruct, deepseek-coder:6.7b-instruct
 */

const fs = require('fs');
const path = require('path');

// Configuración
const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'llama3.1:8b'; // Usando tu modelo ya instalado
const RECIPES_FILE = path.join(__dirname, '../data/recipes-with-normalized.json');
const OUTPUT_FILE = path.join(__dirname, '../data/cooking-actions.json');
const PROGRESS_FILE = path.join(__dirname, '../data/cooking-actions-progress.json');
const BATCH_SIZE = 10;

// Estado global para manejar guardado al interrumpir
let progressState = null;

/**
 * Llama a Ollama API para generar una respuesta
 */
async function callOllama(prompt) {
  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: prompt,
        stream: false,
        temperature: 0.3, // Baja temperatura para respuestas más consistentes
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error calling Ollama:', error);
    throw error;
  }
}

/**
 * Extrae acciones de cocina de un texto de instrucciones
 */
async function extractActionsFromInstructions(instructions) {
  const instructionsText = instructions.join('\n');

  const prompt = `Analiza las siguientes instrucciones de cocina y extrae SOLO las acciones verbales principales (verbos de cocina).

IMPORTANTE:
- Todas las acciones deben estar en ESPAÑOL (infinitivo)
- Si las instrucciones están en inglés, traduce los verbos al español
- Devuelve SOLO una lista separada por comas
- Sin números, sin explicaciones, sin texto adicional

Ejemplos de acciones válidas en ESPAÑOL:
"cortar, mezclar, hornear, batir, cocinar, freír, hervir, amasar, pelar, picar, saltear, marinar"

Instrucciones a analizar:
${instructionsText}

Lista de acciones en español (solo verbos infinitivos separados por comas):`;

  const response = await callOllama(prompt);

  // Limpiar la respuesta y extraer las acciones
  const actions = response
    .toLowerCase()
    .split(',')
    .map(action => action.trim())
    .filter(action => action.length > 0 && action.length < 30) // Filtrar respuestas muy largas
    .filter(action => !action.includes('\n')) // Quitar acciones multi-línea
    .map(action => action.replace(/[^a-záéíóúñü\s]/g, '').trim()); // Solo letras y espacios

  return actions;
}

/**
 * Guarda el progreso actual
 */
function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8');
    progressState = progress; // Actualizar estado global
  } catch (error) {
    console.error('Error guardando progreso:', error.message);
  }
}

/**
 * Carga el progreso previo si existe
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      console.log('\n📋 Se encontró progreso guardado:');
      console.log(`   • Recetas procesadas: ${progress.processedRecipeIds.length}`);
      console.log(`   • Acciones únicas: ${progress.allActions.length}`);
      console.log(`   • Última actualización: ${new Date(progress.lastUpdated).toLocaleString('es-ES')}`);
      return progress;
    }
  } catch (error) {
    console.error('Error cargando progreso:', error.message);
  }
  return null;
}

/**
 * Limpia el archivo de progreso
 */
function clearProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('🗑️  Progreso anterior eliminado\n');
    }
  } catch (error) {
    console.error('Error eliminando progreso:', error.message);
  }
}

/**
 * Procesa todas las recetas y extrae acciones únicas
 */
async function processRecipes(resumeFromProgress = false) {
  console.log('🔥 Iniciando extracción de acciones de cocina...\n');

  // Leer archivo de recetas
  console.log(`📖 Leyendo recetas desde: ${RECIPES_FILE}`);
  const recipesData = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf-8'));
  const recipes = recipesData.recipes;

  console.log(`✅ ${recipes.length} recetas encontradas\n`);

  // Inicializar o cargar progreso
  let allActions = new Set();
  let actionsFrequency = {};
  let processedRecipeIds = new Set();
  let startIndex = 0;

  if (resumeFromProgress) {
    const progress = loadProgress();
    if (progress) {
      console.log('\n✅ Reanudando desde el último progreso...\n');
      allActions = new Set(progress.allActions);
      actionsFrequency = progress.actionsFrequency;
      processedRecipeIds = new Set(progress.processedRecipeIds);
    }
  }

  const totalRecipes = recipes.length;
  let processedCount = processedRecipeIds.size;

  // Configurar manejador de interrupciones (Ctrl+C)
  const interruptHandler = () => {
    console.log('\n\n⚠️  Interrupción detectada (Ctrl+C)');
    console.log('💾 Guardando progreso antes de salir...\n');

    if (progressState) {
      saveProgress(progressState);
      console.log('✅ Progreso guardado correctamente');
      console.log(`   Archivo: ${PROGRESS_FILE}`);
      console.log('\n💡 Ejecuta el script de nuevo para continuar desde donde lo dejaste.\n');
    }

    process.exit(0);
  };

  process.on('SIGINT', interruptHandler);
  process.on('SIGTERM', interruptHandler);

  // Procesar en lotes
  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, Math.min(i + BATCH_SIZE, recipes.length));

    console.log(`\n📦 Procesando lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(recipes.length/BATCH_SIZE)}`);

    for (const recipe of batch) {
      // Saltar si ya fue procesada
      if (processedRecipeIds.has(recipe.id)) {
        continue;
      }

      try {
        console.log(`  🍳 Procesando: "${recipe.name}"`);

        const actions = await extractActionsFromInstructions(recipe.instructions);

        // Agregar al conjunto y contar frecuencia
        actions.forEach(action => {
          if (action) {
            allActions.add(action);
            actionsFrequency[action] = (actionsFrequency[action] || 0) + 1;
          }
        });

        processedRecipeIds.add(recipe.id);
        processedCount++;
        console.log(`     ✓ ${actions.length} acciones extraídas`);

        // Guardar progreso después de cada receta
        const progress = {
          processedRecipeIds: Array.from(processedRecipeIds),
          allActions: Array.from(allActions),
          actionsFrequency: actionsFrequency,
          lastUpdated: new Date().toISOString(),
          model: MODEL_NAME,
        };
        saveProgress(progress);

        // Pequeña pausa para no sobrecargar Ollama
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`     ✗ Error procesando "${recipe.name}":`, error.message);
      }
    }

    // Mostrar resumen del lote
    console.log(`\n   💾 Progreso guardado (${processedCount}/${totalRecipes} recetas)`);
    console.log(`   🎯 ${allActions.size} acciones únicas encontradas`);
  }

  // Ordenar acciones por frecuencia
  const sortedActions = Object.entries(actionsFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([action, frequency]) => ({
      action,
      frequency,
      percentage: ((frequency / processedCount) * 100).toFixed(1)
    }));

  // Crear resultado final
  const result = {
    totalRecipesProcessed: processedCount,
    totalUniqueActions: allActions.size,
    generatedAt: new Date().toISOString(),
    model: MODEL_NAME,
    actions: sortedActions,
    actionsList: Array.from(allActions).sort()
  };

  // Guardar resultado final
  console.log(`\n💾 Guardando resultados finales en: ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');

  // Eliminar archivo de progreso (ya terminamos)
  clearProgress();

  // Mostrar resumen
  console.log('\n' + '='.repeat(60));
  console.log('✨ EXTRACCIÓN COMPLETADA ✨');
  console.log('='.repeat(60));
  console.log(`\n📊 Estadísticas:`);
  console.log(`   • Recetas procesadas: ${processedCount}`);
  console.log(`   • Acciones únicas encontradas: ${allActions.size}`);
  console.log(`\n🏆 Top 20 acciones más frecuentes:`);

  sortedActions.slice(0, 20).forEach((item, index) => {
    console.log(`   ${(index + 1).toString().padStart(2)}. ${item.action.padEnd(20)} - ${item.frequency} veces (${item.percentage}%)`);
  });

  console.log(`\n📝 Lista completa guardada en: ${OUTPUT_FILE}`);
  console.log('\n💡 Usa estas acciones para crear animaciones de Neverito! 🎨\n');
}

// Verificar que Ollama esté corriendo
async function checkOllamaStatus() {
  try {
    console.log('🔍 Verificando conexión con Ollama...');
    const response = await fetch('http://localhost:11434/api/tags');

    if (!response.ok) {
      throw new Error('Ollama no responde correctamente');
    }

    const data = await response.json();
    console.log(`✅ Ollama está corriendo`);

    const hasModel = data.models?.some(m => m.name.includes(MODEL_NAME));
    if (!hasModel) {
      console.warn(`\n⚠️  ADVERTENCIA: El modelo "${MODEL_NAME}" no está instalado.`);
      console.warn(`   Ejecuta: ollama pull ${MODEL_NAME}\n`);
      throw new Error(`Modelo ${MODEL_NAME} no encontrado`);
    }

    console.log(`✅ Modelo "${MODEL_NAME}" disponible\n`);
    return true;

  } catch (error) {
    console.error('\n❌ Error: No se pudo conectar con Ollama');
    console.error('   Asegúrate de que Ollama esté instalado y corriendo:');
    console.error('   1. Instala Ollama: https://ollama.ai');
    console.error(`   2. Ejecuta: ollama pull ${MODEL_NAME}`);
    console.error('   3. Ollama debería estar corriendo en http://localhost:11434\n');
    throw error;
  }
}

// Ejecutar script
(async () => {
  try {
    await checkOllamaStatus();
    await processRecipes(true); // true = permitir reanudar desde progreso
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    process.exit(1);
  }
})();
