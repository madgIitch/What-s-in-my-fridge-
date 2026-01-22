// whats-in-my-fridge-backend/functions/src/replaceRecipes.ts
import * as fs from "fs";
import * as path from "path";

const recipesPath = path.join(__dirname, "../data/recipes.json");
const recipesWithNormalizedPath = path.join(__dirname, "../data/recipes-with-normalized.json");
const backupPath = path.join(__dirname, "../data/recipes.json.backup");

console.log("\n🔄 Reemplazando recipes.json con versión normalizada...\n");

// 1. Verificar que existe recipes-with-normalized.json
if (!fs.existsSync(recipesWithNormalizedPath)) {
  console.error("❌ Error: No se encontró recipes-with-normalized.json");
  console.error("   Ejecuta primero: npx ts-node src/applyNormalizedIngredients.ts\n");
  process.exit(1);
}

// 2. Crear backup del recipes.json original
console.log("💾 Creando backup de recipes.json...");
fs.copyFileSync(recipesPath, backupPath);
console.log(`   ✅ Backup guardado en: ${backupPath}\n`);

// 3. Reemplazar recipes.json con la versión normalizada
console.log("🔄 Reemplazando recipes.json...");
fs.copyFileSync(recipesWithNormalizedPath, recipesPath);
console.log("   ✅ recipes.json actualizado con ingredientsNormalized\n");

// 4. Mostrar tamaños de archivo
const originalSize = (fs.statSync(backupPath).size / 1024 / 1024).toFixed(2);
const newSize = (fs.statSync(recipesPath).size / 1024 / 1024).toFixed(2);

console.log("📊 Tamaños de archivo:");
console.log(`   Original: ${originalSize} MB`);
console.log(`   Nuevo: ${newSize} MB`);
console.log(`   Diferencia: ${(parseFloat(newSize) - parseFloat(originalSize)).toFixed(2)} MB\n`);

console.log("✅ Proceso completado!");
console.log("\n💡 Para restaurar el backup:");
console.log("   copy data\\recipes.json.backup data\\recipes.json\n");
