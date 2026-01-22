/**
 * Script para agregar traducciones en alemán a los ingredientes normalizados
 * Usa Ollama con llama3.1:8b para generar las traducciones
 *
 * Uso: node scripts/add-german-synonyms.js
 */

const fs = require('fs');
const path = require('path');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const INPUT_FILE = path.join(__dirname, '../data/normalized-ingredients.json');
const OUTPUT_FILE = path.join(__dirname, '../data/normalized-ingredients.json');
const BATCH_SIZE = 10;
const DELAY_MS = 500;

async function getGermanTranslation(ingredient) {
  const prompt = `Translate the following food ingredient to German. Return ONLY the German word(s), nothing else. If there are multiple common German names, separate them with commas. Do not include articles (der, die, das). Keep it lowercase.

Ingredient: "${ingredient}"

German translation:`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 50,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.response.trim().toLowerCase();

    // Limpiar y dividir por comas
    const translations = result
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0 && t.length < 50)
      .filter(t => !t.includes('translation') && !t.includes(':'))
      .slice(0, 3);

    return translations;
  } catch (error) {
    console.error(`❌ Error traduciendo "${ingredient}":`, error.message);
    return [];
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🇩🇪 Script de traducción al alemán para ingredientes');
  console.log('====================================================\n');

  // Leer archivo
  console.log(`📖 Leyendo archivo: ${INPUT_FILE}`);
  const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  const vocabulary = JSON.parse(fileContent);

  const ingredients = Object.entries(vocabulary.ingredients);
  console.log(`📊 Total de ingredientes: ${ingredients.length}\n`);

  let processed = 0;
  let added = 0;
  let skipped = 0;
  let errors = 0;

  // Procesar en lotes
  for (let i = 0; i < ingredients.length; i += BATCH_SIZE) {
    const batch = ingredients.slice(i, i + BATCH_SIZE);

    console.log(`\n📦 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ingredients.length / BATCH_SIZE)}`);

    for (const [key, data] of batch) {
      processed++;

      // Verificar si ya tiene sinónimos alemanes
      const hasGerman = data.synonyms.some(syn =>
        /[äöüß]/.test(syn) ||
        ['zwiebel', 'milch', 'reis', 'fleisch', 'käse', 'brot', 'ei', 'pilz', 'salz', 'mehl', 'zucker'].some(de => syn.toLowerCase().includes(de))
      );

      if (hasGerman) {
        console.log(`⏭️  [${processed}/${ingredients.length}] "${key}" - ya tiene sinónimos alemanes`);
        skipped++;
        continue;
      }

      console.log(`🔄 [${processed}/${ingredients.length}] Traduciendo "${key}"...`);

      const germanTranslations = await getGermanTranslation(data.normalized);

      if (germanTranslations.length > 0) {
        const newTranslations = germanTranslations.filter(
          t => !data.synonyms.map(s => s.toLowerCase()).includes(t.toLowerCase())
        );

        if (newTranslations.length > 0) {
          data.synonyms.push(...newTranslations);
          console.log(`   ✅ Agregado: ${newTranslations.join(', ')}`);
          added += newTranslations.length;
        } else {
          console.log(`   ⏭️  Traducciones ya existían`);
        }
      } else {
        console.log(`   ⚠️  Sin traducción encontrada`);
        errors++;
      }

      await delay(DELAY_MS);
    }

    // Guardar progreso cada lote
    vocabulary.lastUpdated = new Date().toISOString();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(vocabulary, null, 2));
    console.log(`💾 Progreso guardado...`);
  }

  // Resumen final
  console.log('\n====================================================');
  console.log('📊 RESUMEN:');
  console.log(`   Total procesados: ${processed}`);
  console.log(`   Sinónimos agregados: ${added}`);
  console.log(`   Saltados (ya tenían alemán): ${skipped}`);
  console.log(`   Errores/sin traducción: ${errors}`);
  console.log(`\n✅ Archivo guardado: ${OUTPUT_FILE}`);
}

main().catch(console.error);
