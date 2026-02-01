/**
 * EJEMPLO DE USO FUTURO
 *
 * Este script muestra cómo puedes usar las acciones extraídas
 * para mapear instrucciones de recetas a animaciones de Neverito
 */

const fs = require('fs');
const path = require('path');

// Cargar las acciones extraídas (después de ejecutar extract-cooking-actions.js)
const ACTIONS_FILE = path.join(__dirname, '../data/cooking-actions.json');

/**
 * Detecta qué acción de cocina está presente en una instrucción
 */
function detectCookingAction(instruction, cookingActions) {
  const instructionLower = instruction.toLowerCase();

  // Buscar en orden de frecuencia (las más comunes primero)
  for (const actionData of cookingActions.actions) {
    const action = actionData.action;

    // Buscar la acción en la instrucción
    // Puedes hacer esto más sofisticado con regex, stemming, etc.
    if (instructionLower.includes(action)) {
      return {
        action: action,
        frequency: actionData.frequency,
        animationFile: `neverito${capitalize(action)}.png`,
      };
    }
  }

  return null;
}

/**
 * Capitaliza la primera letra
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Genera un mapeo de receta a animaciones de Neverito
 */
function mapRecipeToAnimations(recipe, cookingActions) {
  const animations = [];

  recipe.instructions.forEach((instruction, index) => {
    const detectedAction = detectCookingAction(instruction, cookingActions);

    animations.push({
      step: index + 1,
      instruction: instruction,
      action: detectedAction?.action || 'ninguna',
      animationFile: detectedAction?.animationFile || 'neveritoDefault.png',
    });
  });

  return animations;
}

/**
 * Genera estadísticas de qué animaciones necesitas crear
 */
function generateAnimationPriorities(cookingActions) {
  console.log('\n🎨 PRIORIDADES DE ANIMACIÓN PARA NEVERITO\n');
  console.log('Basado en frecuencia de uso en las recetas:\n');

  const top20 = cookingActions.actions.slice(0, 20);

  top20.forEach((actionData, index) => {
    const priority = index < 5 ? '🔥 CRÍTICO' : index < 10 ? '⚡ ALTA' : '📌 MEDIA';
    console.log(
      `${(index + 1).toString().padStart(2)}. ${priority.padEnd(12)} neverito${capitalize(actionData.action)}.png`.padEnd(50) +
        `(usado ${actionData.frequency} veces - ${actionData.percentage}%)`
    );
  });

  console.log('\n💡 Recomendación: Empieza creando las animaciones CRÍTICAS primero\n');
}

/**
 * Ejemplo de uso con una receta real
 */
function exampleUsage() {
  try {
    // Cargar acciones
    const cookingActionsData = JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf-8'));

    console.log('='.repeat(70));
    console.log('📖 EJEMPLO DE USO: Mapeo de Receta a Animaciones de Neverito');
    console.log('='.repeat(70));

    // Receta de ejemplo
    const exampleRecipe = {
      name: 'Pasta con Tomate',
      instructions: [
        'Corta los tomates en cubos pequeños',
        'Hierve agua en una olla grande',
        'Cocina la pasta durante 8-10 minutos',
        'Saltea el ajo en aceite de oliva',
        'Mezcla la pasta con la salsa de tomate',
        'Sirve caliente y decora con albahaca fresca',
      ],
    };

    console.log(`\n🍝 Receta: ${exampleRecipe.name}\n`);

    // Mapear instrucciones a animaciones
    const animations = mapRecipeToAnimations(exampleRecipe, cookingActionsData);

    animations.forEach((anim) => {
      console.log(`Paso ${anim.step}:`);
      console.log(`  📝 Instrucción: ${anim.instruction}`);
      console.log(`  🎬 Acción detectada: ${anim.action}`);
      console.log(`  🎨 Animación: ${anim.animationFile}`);
      console.log('');
    });

    // Generar prioridades
    generateAnimationPriorities(cookingActionsData);

    // Estadísticas generales
    console.log('\n📊 ESTADÍSTICAS GENERALES\n');
    console.log(`Total de acciones únicas: ${cookingActionsData.totalUniqueActions}`);
    console.log(`Recetas analizadas: ${cookingActionsData.totalRecipesProcessed}`);
    console.log(`Modelo usado: ${cookingActionsData.model}`);
    console.log(`Generado el: ${new Date(cookingActionsData.generatedAt).toLocaleDateString('es-ES')}\n`);

    // Lista de archivos de animación a crear
    console.log('\n📁 LISTA DE ARCHIVOS DE ANIMACIÓN A CREAR:\n');
    const top30Actions = cookingActionsData.actions.slice(0, 30);
    top30Actions.forEach((actionData, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. assets/neverito${capitalize(actionData.action)}.png`);
    });

    console.log('\n✨ ¡Ya tienes una lista clara de qué animaciones crear! ✨\n');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('\n❌ Error: No se encontró el archivo cooking-actions.json');
      console.error('   Primero ejecuta: node scripts/extract-cooking-actions.js\n');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Ejecutar ejemplo
exampleUsage();
