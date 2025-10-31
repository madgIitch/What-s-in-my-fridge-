// whats-in-my-fridge-backend/functions/src/normalizeRecipes.ts  
import * as dotenv from 'dotenv';  
import * as functions from 'firebase-functions';  
import OpenAI from 'openai';  
import * as fs from 'fs';  
import * as path from 'path';  
  
// Cargar .env solo en desarrollo local  
if (process.env.FUNCTIONS_EMULATOR === 'true') {  
  dotenv.config();  
}  
  
// Obtener API key según entorno  
const apiKey = process.env.FUNCTIONS_EMULATOR === 'true'   
  ? process.env.OPENAI_API_KEY   
  : functions.config().openai?.key;  
  
const openai = new OpenAI({ apiKey });  
  
async function normalizeIngredients(ingredientsWithMeasures: string[]): Promise<string[]> {  
  const response = await openai.chat.completions.create({  
    model: "gpt-4",  
    messages: [{  
      role: "system",  
      content: "Extract only ingredient names without quantities or measurements. Return as JSON array with key 'ingredients'."  
    }, {  
      role: "user",  
      content: JSON.stringify(ingredientsWithMeasures)  
    }],  
    response_format: { type: "json_object" }  
  });  
    
  const parsed = JSON.parse(response.choices[0].message.content || '{}');  
  return parsed.ingredients || [];  
}  
  
async function processRecipes() {  
  const recipesPath = path.join(__dirname, '../data/recipes.json');  
  const recipesData = JSON.parse(fs.readFileSync(recipesPath, 'utf-8'));  
    
  for (const recipe of recipesData.recipes) {  
    console.log(`Procesando: ${recipe.name}`);  
    recipe.ingredients = await normalizeIngredients(recipe.ingredientsWithMeasures);  
  }  
    
  fs.writeFileSync(recipesPath, JSON.stringify(recipesData, null, 2));  
  console.log('✅ Recetas normalizadas correctamente');  
}  
  
// Ejecutar si se llama directamente  
if (require.main === module) {  
  processRecipes().catch(console.error);  
}