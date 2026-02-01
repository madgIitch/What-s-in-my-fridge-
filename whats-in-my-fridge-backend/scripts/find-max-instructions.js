/**
 * Script para encontrar el número máximo de pasos en las instrucciones
 * de todas las recetas
 */

const fs = require('fs');
const path = require('path');

const RECIPES_FILE = path.join(__dirname, '../data/recipes-with-normalized.json');

console.log('📊 Analizando recetas...\n');

// Leer archivo de recetas
const recipesData = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf-8'));
const recipes = recipesData.recipes;

console.log(`✅ ${recipes.length} recetas encontradas\n`);

// Encontrar el máximo
let maxSteps = 0;
let recipeWithMaxSteps = null;
let totalSteps = 0;
const stepsDistribution = {};

recipes.forEach(recipe => {
  const steps = recipe.instructions?.length || 0;
  totalSteps += steps;

  // Contar distribución
  stepsDistribution[steps] = (stepsDistribution[steps] || 0) + 1;

  // Encontrar máximo
  if (steps > maxSteps) {
    maxSteps = steps;
    recipeWithMaxSteps = recipe;
  }
});

// Calcular promedio
const avgSteps = (totalSteps / recipes.length).toFixed(2);

// Resultados
console.log('=' .repeat(60));
console.log('📈 RESULTADOS');
console.log('='.repeat(60));
console.log(`\n🏆 Número máximo de pasos: ${maxSteps}`);
console.log(`\n📝 Receta con más pasos:`);
console.log(`   Nombre: "${recipeWithMaxSteps.name}"`);
console.log(`   ID: ${recipeWithMaxSteps.id}`);
console.log(`   Pasos: ${maxSteps}`);
console.log(`\n📊 Estadísticas generales:`);
console.log(`   • Promedio de pasos por receta: ${avgSteps}`);
console.log(`   • Total de recetas: ${recipes.length}`);
console.log(`   • Total de pasos en todas las recetas: ${totalSteps}`);

// Mostrar distribución (top 10 más comunes)
console.log(`\n📉 Top 10 cantidades de pasos más comunes:`);
const sortedDistribution = Object.entries(stepsDistribution)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

sortedDistribution.forEach(([steps, count], index) => {
  const percentage = ((count / recipes.length) * 100).toFixed(1);
  console.log(`   ${(index + 1).toString().padStart(2)}. ${steps.toString().padStart(2)} pasos: ${count.toString().padStart(6)} recetas (${percentage}%)`);
});

// Rangos de pasos
console.log(`\n📊 Distribución por rangos:`);
const ranges = [
  { min: 1, max: 3, label: '1-3 pasos (muy simple)' },
  { min: 4, max: 6, label: '4-6 pasos (simple)' },
  { min: 7, max: 10, label: '7-10 pasos (moderado)' },
  { min: 11, max: 15, label: '11-15 pasos (complejo)' },
  { min: 16, max: Infinity, label: '16+ pasos (muy complejo)' }
];

ranges.forEach(range => {
  const count = recipes.filter(r => {
    const steps = r.instructions?.length || 0;
    return steps >= range.min && steps <= range.max;
  }).length;
  const percentage = ((count / recipes.length) * 100).toFixed(1);
  console.log(`   ${range.label.padEnd(30)}: ${count.toString().padStart(6)} recetas (${percentage}%)`);
});

// Mostrar las instrucciones de la receta más larga
console.log(`\n📋 Instrucciones de la receta más larga:\n`);
recipeWithMaxSteps.instructions.forEach((instruction, index) => {
  console.log(`   ${(index + 1).toString().padStart(2)}. "${instruction}"`);
});

console.log('\n' + '='.repeat(60));
console.log('✨ Análisis completado');
console.log('='.repeat(60) + '\n');
