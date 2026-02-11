# Plan de Adaptación para Hackathon - What's In My Fridge

**Hackathon:** Propuesta de Aitum Bernath
**Tiempo disponible:** 1.5 días
**Objetivo:** De "ver una receta" a "cocinarla realmente"

---

## 📋 Análisis de Viabilidad

### ✅ Lo que YA TENEMOS (80% del trabajo)

Nuestro proyecto actual incluye:

1. **Inventario de ingredientes** ✓
   - Gestión completa de alimentos con fechas de caducidad
   - Exactamente lo que pide Aitum (saber qué tienes en la nevera)

2. **Sistema de recetas con IA** ✓
   - Sugerencias personalizadas con Firebase Functions
   - Matching de ingredientes con porcentajes de compatibilidad
   - Backend con Anthropic SDK ya implementado

3. **OCR + parsing de ingredientes** ✓
   - Procesamiento de texto de recibos
   - Normalización de ingredientes con LLM
   - Vision API de Google Cloud

4. **Backend serverless completo** ✓
   - Firebase Functions configurado
   - Firestore para sincronización
   - Firebase Storage para imágenes

5. **Base de datos normalizada** ✓
   - WatermelonDB local (SQLite reactivo)
   - Firestore para sincronización cloud
   - 4 tablas: food_items, parsed_drafts, recipe_cache, ingredients

6. **Sistema de favoritos** ✓
   - Guardar recetas favoritas
   - Persistencia local + cloud

7. **Características adicionales** ✓
   - Calendario de comidas (MealEntry)
   - Notificaciones de caducidad
   - Filtros por ingredientes y categorías

### 🔧 Lo que NECESITAMOS AGREGAR (20% del trabajo)

#### 1. Parser de recetas desde URLs (NUEVO)
Una Cloud Function que tome un link (YouTube, Instagram, TikTok, blogs) y extraiga:
- Nombre de la receta
- Lista de ingredientes
- Pasos de preparación

**Opciones técnicas por plataforma:**
- **YouTube**: Scraping de título + descripción del video + Ollama para extraer ingredientes
- **Instagram**: Scraping del caption/descripción del post + Ollama
- **TikTok**: Scraping de la descripción del video + Ollama
- **Blogs/páginas**: Web scraping tradicional + Ollama para parsear
- **IMPORTANTE:** Usaremos Ollama con modelos open source (ver sección siguiente)

#### 2. Generador de listas de compras (NUEVO)
Una pantalla que:
- Muestre los ingredientes que te **faltan** para hacer una receta
- Permita agregar múltiples recetas a una "lista de compras"
- Se integre con el inventario existente
- Marcar items como comprados

#### 3. Flujo "de la idea a la cocina" (REORGANIZAR UI)
Simplificar la navegación para destacar el pitch del hackathon:
- Pantalla principal: "Pega el link de tu receta favorita"
- Ver qué tienes vs qué necesitas comprar
- Generar lista de compras en un tap

---

## 🤖 Estrategia: Ollama con Modelos Open Source

### ¿Por qué Ollama?

- ✅ **100% Gratis** (sin costos de API)
- ✅ **Sin rate limits** (solo limitado por hardware)
- ✅ **Open source** (mejor para el pitch del hackathon)
- ✅ **Control total** sobre los datos
- ✅ **Privacidad** (no envías datos a terceros)
- ✅ **Más rápido de configurar** para demos

### Opción 1: Ollama en Cloud Run (⭐ RECOMENDADO para hackathon)

**Serverless en Google Cloud - Mismo ecosistema que Firebase**

Esta es la mejor opción porque:
- ✅ No depende de tu laptop
- ✅ Está en el mismo proyecto de Firebase
- ✅ Escala automáticamente
- ✅ Solo pagas cuando se usa (~$0.10/hora cuando está activo)
- ✅ URL pública y persistente

#### Paso 1: Crear Dockerfile optimizado para Cloud Run

Crear `whats-in-my-fridge-backend/Dockerfile.ollama`:

```dockerfile
FROM ollama/ollama:latest

# Variables de entorno
ENV OLLAMA_HOST=0.0.0.0:8080

# Exponer puerto requerido por Cloud Run
EXPOSE 8080

# Crear script de inicio
RUN echo '#!/bin/bash\n\
# Iniciar Ollama en background\n\
ollama serve &\n\
OLLAMA_PID=$!\n\
\n\
# Esperar a que Ollama esté listo\n\
echo "Esperando a que Ollama inicie..."\n\
sleep 10\n\
\n\
# Descargar modelo\n\
echo "Descargando modelo qwen2.5:7b..."\n\
ollama pull qwen2.5:7b\n\
\n\
echo "Modelo descargado. Ollama listo!"\n\
\n\
# Mantener el contenedor vivo\n\
wait $OLLAMA_PID\n\
' > /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh

# Comando de inicio
CMD ["/usr/local/bin/start.sh"]
```

#### Paso 2: Autenticarse en Google Cloud

```bash
# Instalar Google Cloud SDK si no lo tienes
# https://cloud.google.com/sdk/docs/install

# Autenticarse
gcloud auth login

# Configurar proyecto (usa el mismo de Firebase)
gcloud config set project TU_PROYECTO_ID

# Habilitar APIs necesarias
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

#### Paso 3: Build y deploy a Cloud Run

```bash
cd whats-in-my-fridge-backend

# Build de la imagen (tarda ~5-10 minutos la primera vez)
gcloud builds submit --tag gcr.io/TU_PROYECTO_ID/ollama-service -f Dockerfile.ollama

# Deploy a Cloud Run
gcloud run deploy ollama-service \
  --image gcr.io/TU_PROYECTO_ID/ollama-service \
  --platform managed \
  --region europe-west1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 2
```

**Explicación de parámetros:**
- `--memory 4Gi`: Necesario para el modelo de 7B
- `--cpu 2`: 2 vCPUs para mejor rendimiento
- `--timeout 3600`: 1 hora de timeout
- `--allow-unauthenticated`: Permite llamadas sin autenticación (las Cloud Functions ya están autenticadas)
- `--min-instances 0`: Se apaga cuando no se usa (ahorra costos)
- `--max-instances 2`: Limita el escalado (controla costos)

#### Paso 4: Obtener URL del servicio

```bash
# Cloud Run te dará una URL como:
# https://ollama-service-XXXXXXX-ew.a.run.app

# Guardar esta URL para usarla en Firebase Functions
```

#### Paso 5: Configurar Firebase Functions

```bash
# Configurar la URL de Ollama en Firebase
firebase functions:config:set ollama.url="https://ollama-service-XXXXXXX-ew.a.run.app"
firebase functions:config:set ollama.model="qwen2.5:7b"
```

#### Paso 6: Testing

```bash
# Test básico
curl https://ollama-service-XXXXXXX-ew.a.run.app/api/tags

# Test de generación
curl https://ollama-service-XXXXXXX-ew.a.run.app/api/generate -d '{
  "model": "qwen2.5:7b",
  "prompt": "Extrae los ingredientes: Paella con pollo, arroz, azafrán",
  "stream": false,
  "format": "json"
}'
```

#### Consideraciones de costos

**Cloud Run pricing (región europe-west1):**
- CPU: $0.00002400/vCPU-segundo
- Memoria: $0.00000250/GiB-segundo
- Requests: $0.40 por millón

**Estimación para el hackathon:**
- 50 requests durante el hackathon
- ~10 segundos por request
- Total: ~$0.50 USD

**Estimación mensual (uso moderado):**
- 500 requests/mes
- Total: ~$5 USD/mes

---

### Opción 2: Ollama Local + ngrok (Para desarrollo rápido)

**Para desarrollo y demo rápido en tu laptop**

#### Paso 1: Instalar Ollama en Windows

```bash
# Opción A: Descargar instalador
# https://ollama.com/download/windows

# Opción B: Con winget
winget install Ollama.Ollama
```

#### Paso 2: Descargar modelo recomendado

```bash
# Opción 1: Qwen 2.5 7B (⭐ RECOMENDADO - rápido, bueno para JSON)
ollama pull qwen2.5:7b

# Opción 2: Llama 3.3 70B (más potente, más lento, necesita más RAM)
ollama pull llama3.3:70b

# Opción 3: Gemma 2 9B (balanceado, bueno para español)
ollama pull gemma2:9b

# Opción 4: Llama 3.2 3B (muy rápido, menos preciso)
ollama pull llama3.2:3b
```

**Comparación de modelos:**

| Modelo | Tamaño | RAM necesaria | Velocidad | Precisión | Mejor para |
|--------|--------|---------------|-----------|-----------|------------|
| Qwen 2.5 7B | 4.7GB | 8GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | JSON estructurado |
| Llama 3.3 70B | 40GB | 64GB | ⚡ | ⭐⭐⭐⭐⭐ | Máxima precisión |
| Gemma 2 9B | 5.4GB | 10GB | ⚡⚡ | ⭐⭐⭐⭐ | Multilingüe |
| Llama 3.2 3B | 2GB | 4GB | ⚡⚡⚡⚡ | ⭐⭐⭐ | Demos rápidas |

#### Paso 3: Verificar que Ollama está corriendo

```bash
# Ollama corre automáticamente en http://localhost:11434
curl http://localhost:11434/api/tags

# Debería devolver lista de modelos instalados
```

#### Paso 4: Exponer Ollama con ngrok

```bash
# Instalar ngrok (https://ngrok.com/download)
# O con Chocolatey:
choco install ngrok

# Exponer puerto de Ollama
ngrok http 11434

# ngrok te dará una URL pública como:
# https://abc123.ngrok.io
```

**Guardar la URL de ngrok** para usarla en Firebase Functions.

#### Paso 5: Probar Ollama manualmente

```bash
# Test básico
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:7b",
  "prompt": "Extrae los ingredientes de esta receta: Paella valenciana con pollo, conejo, judías verdes, garrofón, tomate, azafrán y arroz",
  "stream": false,
  "format": "json"
}'
```

---

### Opción 3: Ollama en Railway/Render (Alternativa)

**Si prefieres no usar Google Cloud**

#### Railway (tiene free tier limitado)

1. **Crear cuenta en [Railway](https://railway.app)**

2. **Usar el mismo Dockerfile.ollama**

3. **Deploy desde GitHub:**
   - Conectar repositorio
   - Seleccionar `Dockerfile.ollama`
   - Railway despliega automáticamente

**Nota:** Railway free tier tiene límites de horas/mes, puede no ser suficiente para el hackathon.

---

## 💻 Código: Cloud Function con Ollama

### Paso 1: Instalar dependencias

```bash
cd whats-in-my-fridge-backend/functions
npm install axios cheerio @types/cheerio
```

### Paso 2: Crear nueva Cloud Function

Crear archivo `whats-in-my-fridge-backend/functions/src/parseRecipeFromUrl.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';

// URL de Ollama en Cloud Run
const OLLAMA_URL = functions.config().ollama?.url || process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = functions.config().ollama?.model || process.env.OLLAMA_MODEL || 'qwen2.5:7b';

/**
 * Cloud Function: Parsear receta desde URL
 *
 * Input: { url: string }
 * Output: { recipeId, recipe: { name, ingredients, instructions } }
 */
export const parseRecipeFromUrl = functions
  .region('europe-west1')
  .runWith({
    memory: '1GB',
    timeoutSeconds: 300
  })
  .https.onCall(async (data, context) => {
    // 1. Validar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Debe estar autenticado'
      );
    }

    const { url } = data;
    if (!url) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'URL es requerida'
      );
    }

    const userId = context.auth.uid;

    try {
      console.log(`📖 Parseando receta desde: ${url}`);

      // 2. Scrapear contenido de la página
      const pageContent = await scrapeRecipePage(url);
      console.log(`📄 Contenido extraído: ${pageContent.length} caracteres`);

      // 3. Extraer ingredientes con Ollama
      const recipe = await extractIngredientsWithOllama(pageContent);
      console.log(`🍳 Receta parseada: ${recipe.recipeName}`);
      console.log(`📋 Ingredientes encontrados: ${recipe.ingredients.length}`);

      // 4. Normalizar ingredientes (reutiliza función existente)
      const normalizedIngredients = await Promise.all(
        recipe.ingredients.map(ing => normalizeIngredientWithOllama(ing))
      );

      // 5. Comparar con inventario del usuario
      const userInventory = await getUserInventory(userId);
      const { matched, missing } = compareWithInventory(
        normalizedIngredients,
        userInventory
      );

      // 6. Guardar en Firestore
      const recipeData = {
        name: recipe.recipeName,
        sourceUrl: url,
        ingredients: normalizedIngredients,
        matchedIngredients: matched,
        missingIngredients: missing,
        instructions: recipe.instructions,
        servings: recipe.servings || null,
        matchPercentage: Math.round((matched.length / normalizedIngredients.length) * 100),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const recipeRef = await admin
        .firestore()
        .collection('users')
        .doc(userId)
        .collection('saved_recipes')
        .add(recipeData);

      console.log(`✅ Receta guardada: ${recipeRef.id}`);

      return {
        success: true,
        recipeId: recipeRef.id,
        recipe: recipeData,
      };

    } catch (error: any) {
      console.error('❌ Error parseando receta:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Scrapear contenido de una página web o video
 */
async function scrapeRecipePage(url: string): Promise<string> {
  try {
    // Detectar tipo de URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return await scrapeYouTube(url);
    }

    if (url.includes('instagram.com')) {
      return await scrapeInstagram(url);
    }

    if (url.includes('tiktok.com')) {
      return await scrapeTikTok(url);
    }

    // Scraping simple con cheerio para blogs/páginas web
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // Intentar extraer contenido de receta (ajustar según estructura común)
    // Muchas páginas de recetas usan schema.org/Recipe
    let recipeText = '';

    // Buscar en elementos comunes de recetas
    const selectors = [
      '[itemtype*="Recipe"]',
      '.recipe',
      '#recipe',
      'article',
      'main'
    ];

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        recipeText = element.text();
        break;
      }
    }

    // Fallback: todo el body
    if (!recipeText || recipeText.length < 100) {
      recipeText = $('body').text();
    }

    // Limpiar espacios en blanco excesivos
    recipeText = recipeText
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // Limitar a 15k caracteres

    if (recipeText.length < 50) {
      throw new Error('No se pudo extraer suficiente contenido de la página');
    }

    return recipeText;

  } catch (error: any) {
    console.error('Error scrapeando página:', error);
    throw new Error(`Error obteniendo contenido: ${error.message}`);
  }
}

/**
 * Extraer contenido de video de YouTube
 */
async function scrapeYouTube(url: string): Promise<string> {
  try {
    console.log('📺 Extrayendo contenido de YouTube...');

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // Extraer título y descripción del video
    const title = $('meta[name="title"]').attr('content') ||
                  $('meta[property="og:title"]').attr('content') || '';

    const description = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') || '';

    const text = `Título: ${title}\n\nDescripción: ${description}`;

    if (text.length < 50) {
      throw new Error(
        'No se pudo extraer suficiente información del video de YouTube. ' +
        'Asegúrate de que el video tenga ingredientes en la descripción.'
      );
    }

    console.log(`📺 YouTube - Título: ${title}`);
    console.log(`📺 YouTube - Descripción: ${description.substring(0, 200)}...`);

    return text;

  } catch (error: any) {
    console.error('Error extrayendo contenido de YouTube:', error);
    throw new Error(`Error con video de YouTube: ${error.message}`);
  }
}

/**
 * Extraer contenido de post de Instagram
 */
async function scrapeInstagram(url: string): Promise<string> {
  try {
    console.log('📸 Extrayendo contenido de Instagram...');

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // Instagram usa meta tags para compartir
    const description = $('meta[property="og:description"]').attr('content') ||
                       $('meta[name="description"]').attr('content') || '';

    const title = $('meta[property="og:title"]').attr('content') || '';

    const text = `Post de Instagram\n\n${title}\n\n${description}`;

    if (description.length < 30) {
      throw new Error(
        'No se pudo extraer el caption de Instagram. ' +
        'La cuenta puede ser privada o el enlace inválido. ' +
        'Asegúrate de que el post tenga ingredientes en el caption.'
      );
    }

    console.log(`📸 Instagram - Caption: ${description.substring(0, 200)}...`);

    return text;

  } catch (error: any) {
    console.error('Error extrayendo contenido de Instagram:', error);
    throw new Error(`Error con post de Instagram: ${error.message}`);
  }
}

/**
 * Extraer contenido de video de TikTok
 */
async function scrapeTikTok(url: string): Promise<string> {
  try {
    console.log('🎵 Extrayendo contenido de TikTok...');

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // TikTok usa meta tags para compartir
    const description = $('meta[property="og:description"]').attr('content') ||
                       $('meta[name="description"]').attr('content') || '';

    const title = $('meta[property="og:title"]').attr('content') || '';

    const text = `Video de TikTok\n\n${title}\n\n${description}`;

    if (description.length < 30) {
      throw new Error(
        'No se pudo extraer la descripción de TikTok. ' +
        'El video puede ser privado o el enlace inválido. ' +
        'Asegúrate de que el video tenga ingredientes en la descripción.'
      );
    }

    console.log(`🎵 TikTok - Descripción: ${description.substring(0, 200)}...`);

    return text;

  } catch (error: any) {
    console.error('Error extrayendo contenido de TikTok:', error);
    throw new Error(`Error con video de TikTok: ${error.message}`);
  }
}

/**
 * Extraer ingredientes de texto usando Ollama
 */
async function extractIngredientsWithOllama(recipeText: string) {
  const prompt = `Analiza este contenido de receta y extrae la información en formato JSON.

Contenido:
${recipeText}

Devuelve SOLO un objeto JSON con esta estructura exacta:
{
  "recipeName": "nombre descriptivo de la receta",
  "ingredients": ["ingrediente 1", "ingrediente 2", "ingrediente 3"],
  "instructions": "pasos de preparación resumidos en un párrafo",
  "servings": número de porciones (si está disponible, sino null)
}

Reglas importantes:
- "ingredients" debe ser un array de strings
- Cada ingrediente en singular y sin cantidades (ej: "tomate" no "200g de tomates")
- Solo el nombre del ingrediente principal (ej: "aceite de oliva" → "aceite de oliva")
- "instructions" debe ser un resumen coherente de los pasos
- Si no encuentras información, devuelve arrays vacíos o null
- NO incluyas texto adicional, SOLO el JSON`;

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      format: 'json', // Fuerza respuesta en JSON
      options: {
        temperature: 0.3, // Más determinista
        top_p: 0.9,
        num_predict: 1000, // Máximo tokens
      }
    }, {
      timeout: 120000 // 2 minutos timeout
    });

    // Ollama devuelve { response: "json string" }
    const jsonResponse = response.data.response;
    const parsed = JSON.parse(jsonResponse);

    // Validar estructura
    if (!parsed.recipeName || !Array.isArray(parsed.ingredients)) {
      throw new Error('Respuesta de Ollama con formato inválido');
    }

    return {
      recipeName: parsed.recipeName,
      ingredients: parsed.ingredients.filter((ing: string) => ing && ing.trim()),
      instructions: parsed.instructions || '',
      servings: parsed.servings || null,
    };

  } catch (error: any) {
    console.error('Error llamando a Ollama:', error);
    throw new Error(`Error extrayendo ingredientes: ${error.message}`);
  }
}

/**
 * Normalizar un ingrediente (remover cantidades, plurales, etc.)
 */
async function normalizeIngredientWithOllama(ingredient: string): Promise<string> {
  const prompt = `Normaliza este ingrediente a su forma más simple en español (singular, sin cantidades).

Ingrediente: "${ingredient}"

Devuelve SOLO el ingrediente normalizado, sin explicaciones ni texto adicional.

Ejemplos:
- "tomates cherry" → "tomate"
- "aceite de oliva virgen extra" → "aceite de oliva"
- "200g de harina de trigo" → "harina"
- "2 cebollas grandes" → "cebolla"
- "sal y pimienta" → "sal"`;

  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1, // Muy determinista
        num_predict: 20, // Máximo 20 tokens
      }
    }, {
      timeout: 30000 // 30 segundos
    });

    const normalized = response.data.response
      .trim()
      .toLowerCase()
      .replace(/['"]/g, '') // Remover comillas
      .replace(/\.$/, ''); // Remover punto final

    return normalized || ingredient.toLowerCase();

  } catch (error: any) {
    console.error(`Error normalizando "${ingredient}":`, error);
    // Fallback: normalización básica
    return ingredient.toLowerCase().trim();
  }
}

/**
 * Obtener inventario del usuario
 */
async function getUserInventory(userId: string): Promise<string[]> {
  const inventorySnapshot = await admin
    .firestore()
    .collection('users')
    .doc(userId)
    .collection('inventory')
    .get();

  return inventorySnapshot.docs.map(doc => {
    const data = doc.data();
    return (data.normalizedName || data.name || '').toLowerCase().trim();
  }).filter(name => name.length > 0);
}

/**
 * Comparar ingredientes de receta con inventario
 */
function compareWithInventory(
  recipeIngredients: string[],
  userInventory: string[]
): { matched: string[], missing: string[] } {
  const inventorySet = new Set(
    userInventory.map(ing => ing.toLowerCase().trim())
  );

  const matched: string[] = [];
  const missing: string[] = [];

  for (const ingredient of recipeIngredients) {
    const normalized = ingredient.toLowerCase().trim();
    if (inventorySet.has(normalized)) {
      matched.push(ingredient);
    } else {
      missing.push(ingredient);
    }
  }

  return { matched, missing };
}
```

### Paso 3: Exportar la función

Editar `whats-in-my-fridge-backend/functions/src/index.ts`:

```typescript
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {parseReceipt} from "./parseReceipt";
import {getRecipeSuggestions} from "./recipeMatcher";
import {normalizeScannedIngredient, normalizeScannedIngredientsBatch} from "./normalizeScannedIngredient";
import {parseRecipeFromUrl} from "./parseRecipeFromUrl"; // 👈 NUEVO

// Inicializar Firebase Admin
admin.initializeApp();

// Exportar Cloud Functions
export {parseReceipt};
export {getRecipeSuggestions};
export {normalizeScannedIngredient, normalizeScannedIngredientsBatch};
export {parseRecipeFromUrl}; // 👈 NUEVO
```

### Paso 4: Configurar variables de entorno

Editar `whats-in-my-fridge-backend/functions/.env`:

```bash
# Ollama configuration
OLLAMA_URL=https://tu-ngrok-url.ngrok.io  # Cambiar por tu URL
OLLAMA_MODEL=qwen2.5:7b
```

Para producción, usar Firebase config:

```bash
firebase functions:config:set ollama.url="https://tu-railway-url.railway.app"
firebase functions:config:set ollama.model="qwen2.5:7b"
```

Y en el código:

```typescript
const OLLAMA_URL = functions.config().ollama?.url || process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = functions.config().ollama?.model || process.env.OLLAMA_MODEL || 'qwen2.5:7b';
```

---

## 📱 Frontend: Pantalla para agregar recetas desde URL

### Paso 1: Crear nueva pantalla

Crear `src/screens/AddRecipeFromUrlScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Link2, Check, X } from 'lucide-react-native';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { parseRecipeFromUrl } from '../services/firebase/functions';
import { RootStackParamList } from '../types';

type NavigationProp = StackNavigationProp<RootStackParamList, 'AddRecipeFromUrl'>;

const AddRecipeFromUrlScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleParseRecipe = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL');
      return;
    }

    // Validar URL básica
    try {
      new URL(url);
    } catch {
      Alert.alert('Error', 'URL inválida. Asegúrate de incluir https://');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await parseRecipeFromUrl(url);
      setResult(response.recipe);

      Alert.alert(
        '¡Receta importada! ✨',
        `${response.recipe.name}\n\nIngredientes: ${response.recipe.ingredients.length}\nTienes: ${response.recipe.matchedIngredients.length}\nNecesitas: ${response.recipe.missingIngredients.length}`,
        [
          {
            text: 'Ver lista de compras',
            onPress: () => navigation.navigate('ShoppingList', { recipeId: response.recipeId })
          },
          {
            text: 'Ver receta',
            onPress: () => navigation.navigate('RecipeSteps', { recipe: response.recipe })
          }
        ]
      );

    } catch (error: any) {
      console.error('Error parsing recipe:', error);
      Alert.alert(
        'Error',
        error.message || 'No se pudo parsear la receta. Intenta con otra URL.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🔗 Agregar Receta desde URL</Text>
          <Text style={styles.subtitle}>
            Pega el link de cualquier receta que veas online
          </Text>
        </View>

        {/* Input Card */}
        <Card style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Link2 size={24} color={colors.primary} />
            <Text style={styles.inputLabel}>URL de la receta</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="https://ejemplo.com/mi-receta-favorita"
            placeholderTextColor={colors.onSurfaceVariant}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
          />

          <Text style={styles.hint}>
            💡 Funciona con YouTube, Instagram, TikTok y blogs
          </Text>

          <Button
            title={loading ? 'Analizando receta...' : '✨ Importar Receta'}
            onPress={handleParseRecipe}
            disabled={loading || !url.trim()}
            style={styles.button}
          />
        </Card>

        {/* Loading State */}
        {loading && (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Analizando receta...</Text>
            <Text style={styles.loadingSubtext}>
              Esto puede tomar unos segundos ⏱️
            </Text>
          </Card>
        )}

        {/* Result Preview */}
        {result && !loading && (
          <Card style={styles.resultCard}>
            <Text style={styles.resultTitle}>✅ Receta importada</Text>
            <Text style={styles.recipeName}>{result.name}</Text>

            {/* Match Stats */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Check size={20} color={colors.success} />
                <Text style={styles.statLabel}>Tienes</Text>
                <Text style={styles.statValue}>{result.matchedIngredients.length}</Text>
              </View>
              <View style={styles.stat}>
                <X size={20} color={colors.error} />
                <Text style={styles.statLabel}>Necesitas</Text>
                <Text style={styles.statValue}>{result.missingIngredients.length}</Text>
              </View>
            </View>

            {/* Match Percentage */}
            <View style={styles.matchContainer}>
              <Text style={styles.matchLabel}>Compatibilidad</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${result.matchPercentage}%` }
                  ]}
                />
              </View>
              <Text style={styles.matchPercentage}>{result.matchPercentage}%</Text>
            </View>

            {/* Missing Ingredients */}
            {result.missingIngredients.length > 0 && (
              <View style={styles.missingSection}>
                <Text style={styles.sectionTitle}>🛒 Necesitas comprar:</Text>
                {result.missingIngredients.map((ing: string, idx: number) => (
                  <Text key={idx} style={styles.missingItem}>• {ing}</Text>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* Examples */}
        <Card style={styles.examplesCard}>
          <Text style={styles.examplesTitle}>📱 Plataformas soportadas</Text>
          <Text style={styles.exampleItem}>✓ 📺 YouTube (descripción del video)</Text>
          <Text style={styles.exampleItem}>✓ 📸 Instagram (caption del post)</Text>
          <Text style={styles.exampleItem}>✓ 🎵 TikTok (descripción del video)</Text>
          <Text style={styles.exampleItem}>✓ 📰 Blogs de cocina</Text>
          <Text style={styles.exampleItem}>✓ 🌐 Páginas web de recetas</Text>

          <Text style={styles.examplesNote}>
            💡 Tip: Los videos deben tener ingredientes en la descripción/caption
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE5EC',
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.headlineLarge,
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
  },
  inputCard: {
    marginBottom: spacing.lg,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  input: {
    ...typography.bodyLarge,
    borderWidth: 2,
    borderColor: colors.outline,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.sm,
  },
  loadingCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  loadingText: {
    ...typography.titleMedium,
    color: colors.onSurface,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  loadingSubtext: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  resultCard: {
    marginBottom: spacing.lg,
  },
  resultTitle: {
    ...typography.titleLarge,
    color: colors.success,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  recipeName: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  statValue: {
    ...typography.headlineMedium,
    color: colors.onSurface,
    fontWeight: 'bold',
    marginTop: spacing.xs,
  },
  matchContainer: {
    marginBottom: spacing.lg,
  },
  matchLabel: {
    ...typography.labelMedium,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 12,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  matchPercentage: {
    ...typography.titleSmall,
    color: colors.primary,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  missingSection: {
    backgroundColor: 'rgba(255, 107, 157, 0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  missingItem: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  examplesCard: {
    backgroundColor: 'rgba(181, 234, 215, 0.3)',
  },
  examplesTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  exampleItem: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  examplesNote: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});

export default AddRecipeFromUrlScreen;
```

### Paso 2: Crear servicio de Firebase Functions

Editar `src/services/firebase/functions.ts`:

```typescript
import functions from '@react-native-firebase/functions';

// ... otras funciones existentes ...

/**
 * Parsear receta desde URL
 */
export const parseRecipeFromUrl = async (url: string) => {
  const callable = functions().httpsCallable('parseRecipeFromUrl');

  try {
    const result = await callable({ url });
    return result.data;
  } catch (error: any) {
    console.error('Error calling parseRecipeFromUrl:', error);
    throw new Error(error.message || 'Error parseando receta');
  }
};
```

### Paso 3: Agregar ruta en navegación

Editar `src/navigation/AppNavigator.tsx`:

```typescript
// ... imports ...
import AddRecipeFromUrlScreen from '../screens/AddRecipeFromUrlScreen';

// ... en el Stack.Navigator ...
<Stack.Screen
  name="AddRecipeFromUrl"
  component={AddRecipeFromUrlScreen}
  options={{ title: 'Agregar desde URL' }}
/>
```

### Paso 4: Agregar botón en HomeScreen

Editar `src/screens/HomeScreen.tsx` para agregar acceso rápido:

```typescript
<Button
  title="🔗 Importar Receta desde URL"
  onPress={() => navigation.navigate('AddRecipeFromUrl')}
  style={styles.importButton}
/>
```

---

## 📅 Plan de Implementación (1.5 días)

### **Día 1 - Miércoles (12 horas)**

#### Mañana (4 horas) - Setup Ollama en Cloud Run + Backend
- ✅ **[30min]** Autenticarse en Google Cloud y configurar proyecto
- ✅ **[1h]** Crear Dockerfile.ollama y hacer build de la imagen
- ✅ **[1h]** Deploy a Cloud Run y obtener URL del servicio
- ✅ **[30min]** Testing de Ollama en Cloud Run
- ✅ **[1h]** Crear Cloud Function `parseRecipeFromUrl`

#### Tarde (4 horas) - Integración con Ollama + Soporte multi-plataforma
- ✅ **[1.5h]** Implementar `extractIngredientsWithOllama`
- ✅ **[1.5h]** Implementar funciones de scraping:
  - `scrapeYouTube`
  - `scrapeInstagram`
  - `scrapeTikTok`
- ✅ **[30min]** Implementar `normalizeIngredientWithOllama`
- ✅ **[30min]** Testing de la Cloud Function con URLs reales de cada plataforma

#### Noche (4 horas) - Frontend básico
- ✅ **[2h]** Crear `AddRecipeFromUrlScreen`
- ✅ **[1h]** Integrar con Cloud Function
- ✅ **[1h]** Testing en app móvil con URLs de prueba

### **Día 2 - Jueves (hasta deadline)**

#### Mañana (4 horas) - Shopping List
- ✅ **[2h]** Crear modelo `ShoppingList` en WatermelonDB
- ✅ **[2h]** Crear pantalla `ShoppingListScreen`

#### Tarde (4 horas) - Pulido y testing
- ✅ **[2h]** Integrar shopping list con inventario
- ✅ **[1h]** Agregar animaciones y mejoras UI
- ✅ **[1h]** Testing end-to-end del flujo completo con todas las plataformas

#### Pre-deadline (2 horas) - Presentación
- ✅ **[1h]** Grabar video demo mostrando YouTube, Instagram, TikTok
- ✅ **[30min]** Preparar slides/pitch
- ✅ **[30min]** Submit al hackathon

---

## 🎯 Pitch Adaptado para el Hackathon

### **Elevator Pitch (30 segundos)**

> "**What's In My Fridge** convierte cualquier receta que veas online en tu próxima comida. ¿Viste una receta increíble en TikTok, Instagram o YouTube? Solo pega el link, y la app te dice exactamente qué necesitas comprar. Tu inventario inteligente se sincroniza entre dispositivos, te avisa de caducidades, y te sugiere recetas con lo que YA tienes. **De la inspiración a la cocina en 30 segundos.** ✨"

### **Puntos clave para destacar**

1. **Soluciona el problema de Aitum**: "De ver una receta a cocinarla"
   - ✓ Input: URL de receta (YouTube, Instagram, TikTok, blogs)
   - ✓ Output: Lista de compras exacta

2. **Tecnología open source**:
   - ✓ Ollama con modelos open source (Qwen 2.5)
   - ✓ React Native multiplataforma
   - ✓ Firebase serverless

3. **Características únicas**:
   - ✓ **Soporte multi-plataforma**: YouTube, Instagram, TikTok, blogs
   - ✓ Normalización inteligente de ingredientes con LLM
   - ✓ Comparación automática con inventario
   - ✓ OCR de recibos (bonus feature)
   - ✓ Sincronización multi-dispositivo

4. **Impacto real**:
   - ✓ Reduce desperdicio de alimentos
   - ✓ Ahorra tiempo en planificación
   - ✓ Facilita la vida en la cocina
   - ✓ Conecta con cómo la gente realmente descubre recetas (redes sociales)

### **Demo Flow**

1. **Mostrar inventario actual** (2-3 ingredientes)
2. **Demostrar soporte multi-plataforma**:
   - 📺 Pegar URL de YouTube (receta de pasta)
   - 📸 Pegar URL de Instagram (post de chef famoso)
   - 🎵 Pegar URL de TikTok (receta viral)
3. **Ver análisis en tiempo real** (loading de Ollama)
4. **Mostrar resultado para cada plataforma**:
   - Receta parseada ✅
   - Ingredientes que tienes 😊
   - Ingredientes que necesitas 🛒
   - Compatibilidad % con tu inventario
5. **Generar lista de compras** automáticamente
6. **BONUS**: Escanear recibo → agregar a inventario automáticamente

---

## 🧪 Testing y Validación

### URLs de ejemplo para probar

```bash
# Blogs de cocina en español
https://www.recetasgratis.net/receta-de-paella-valenciana-autentica-70337.html
https://www.directoalpaladar.com/recetas-de-carnes-y-aves/pollo-al-ajillo-receta-tradicional

# YouTube (debe tener ingredientes en la descripción)
https://www.youtube.com/watch?v=[video-id]
# Buscar videos con "receta" que incluyan ingredientes en la descripción

# Instagram (debe tener ingredientes en el caption)
https://www.instagram.com/p/[post-id]/
# Buscar posts de chefs que pongan recetas en los captions

# TikTok (debe tener ingredientes en la descripción)
https://www.tiktok.com/@usuario/video/[video-id]
# Buscar videos de recetas con ingredientes en la descripción

# Páginas internacionales
https://www.allrecipes.com/recipe/16354/easy-meatloaf/
```

### Checklist de validación

- [ ] Cloud Run desplegado correctamente
- [ ] Ollama responde en la URL de Cloud Run
- [ ] Cloud Function puede llamar a Ollama en Cloud Run
- [ ] **Scraping de YouTube funciona** (título + descripción)
- [ ] **Scraping de Instagram funciona** (caption)
- [ ] **Scraping de TikTok funciona** (descripción)
- [ ] Scraping extrae contenido de blogs/páginas
- [ ] Ollama parsea ingredientes correctamente
- [ ] Normalización de ingredientes funciona
- [ ] Comparación con inventario es precisa
- [ ] Frontend muestra resultados correctos
- [ ] Shopping list se genera bien
- [ ] Flujo completo funciona end-to-end para todas las plataformas

---

## 📊 Métricas de éxito

### Durante el desarrollo
- ⏱️ **Tiempo de respuesta de Ollama**: < 10 segundos
- 🎯 **Precisión de parsing**: > 80% de ingredientes correctos
- 📱 **UX fluida**: Feedback visual en cada paso
- 🌐 **Compatibilidad**: YouTube, Instagram, TikTok y blogs funcionando

### Para la demo
- ✅ **3+ URLs diferentes parseadas con éxito** (una de cada plataforma)
- ✅ **Demostrar YouTube, Instagram y TikTok**
- ✅ **Comparación con inventario funcional**
- ✅ **Shopping list generada automáticamente**
- ✅ **Video demo < 2 minutos**

---

## 🚀 Deployment Checklist

### Para el hackathon (demo)
- [ ] Ollama desplegado en Cloud Run
- [ ] URL de Cloud Run configurada en Firebase Functions
- [ ] Firebase Functions desplegadas
- [ ] App compilada en dispositivo de prueba
- [ ] 5+ URLs de ejemplo testeadas (YouTube, Instagram, TikTok, blogs)
- [ ] Video demo grabado mostrando todas las plataformas

### Post-hackathon (producción)
- [ ] Optimizar costos de Cloud Run (min-instances, timeout)
- [ ] Implementar caché de recetas parseadas
- [ ] Mejorar scraping con APIs oficiales (opcional)
- [ ] Monitorear uso y costos en Cloud Console
- [ ] Build de producción (APK/IPA)
- [ ] Publicar en stores (opcional)

---

## 🎁 Features Bonus (si sobra tiempo)

1. **Soporte para transcripts de YouTube**
   - Usar APIs de terceros para obtener transcripts completos
   - Parsing más preciso de videos largos

2. **Smart Shopping List**
   - Agrupar por categorías (lácteos, carnes, verduras)
   - Estimar precios basados en histórico
   - Compartir lista con otras apps

3. **Reconocimiento de influencers**
   - Detectar chef/creador de contenido
   - Guardar automáticamente en colección del chef

4. **Meal Planning**
   - Calendario semanal de comidas
   - Generar lista de compras para toda la semana
   - Integración con recetas favoritas

5. **Gamification**
   - Badges por recetas cocinadas
   - Streaks de cocina diaria
   - Compartir logros

---

## 📞 Troubleshooting

### Problema: Ollama no responde
```bash
# Verificar que Ollama está corriendo
curl http://localhost:11434/api/tags

# Reiniciar Ollama
# En Windows: Cerrar proceso y volver a abrir
```

### Problema: ngrok se desconecta
```bash
# ngrok free tiene sesiones de 2 horas
# Solución: Volver a levantar y actualizar URL en .env

# Alternativa: Usar Cloudflare Tunnel (gratis, persistente)
cloudflared tunnel --url http://localhost:11434
```

### Problema: Ollama parsea mal los ingredientes
```typescript
// Ajustar el prompt para ser más específico
// Agregar más ejemplos en el prompt
// Usar temperatura más baja (0.1 - 0.3)
// Probar con otro modelo (gemma2:9b)
```

### Problema: Scraping no funciona en YouTube/Instagram/TikTok
```typescript
// Algunas plataformas bloquean bots
// Soluciones:
// 1. Agregar User-Agent real
// 2. Verificar que la URL sea pública
// 3. Para Instagram/TikTok: la cuenta debe ser pública
// 4. Fallback: copiar/pegar descripción manualmente
```

### Problema: Instagram/TikTok devuelven poco texto
```
// Estos videos DEBEN tener ingredientes en la descripción/caption
// No todos los videos los incluyen
// Solución: Instruir al usuario a usar videos con ingredientes listados
// O usar APIs de terceros (RapidAPI) como alternativa
```

---

## 📚 Recursos y Referencias

### Ollama
- [Documentación oficial](https://github.com/ollama/ollama)
- [Modelos disponibles](https://ollama.com/library)
- [API Reference](https://github.com/ollama/ollama/blob/main/docs/api.md)

### Firebase
- [Cloud Functions](https://firebase.google.com/docs/functions)
- [Firestore](https://firebase.google.com/docs/firestore)
- [React Native Firebase](https://rnfirebase.io)

### Web Scraping
- [Cheerio](https://cheerio.js.org)
- [Axios](https://axios-http.com)
- [Schema.org Recipe](https://schema.org/Recipe)

### APIs de terceros (opcional)
- [RapidAPI - YouTube](https://rapidapi.com/hub)
- [RapidAPI - Instagram](https://rapidapi.com/restyler/api/instagram-scraper-api2)
- [RapidAPI - TikTok](https://rapidapi.com/yi005/api/tiktok-scraper7)

### Modelos LLM
- [Qwen 2.5](https://ollama.com/library/qwen2.5)
- [Llama 3.3](https://ollama.com/library/llama3.3)
- [Gemma 2](https://ollama.com/library/gemma2)

---

## ✅ Checklist Final

### Pre-hackathon
- [ ] Google Cloud SDK instalado
- [ ] Proyecto de Firebase configurado en gcloud
- [ ] Ollama desplegado en Cloud Run
- [ ] URL de Cloud Run obtenida y configurada
- [ ] Cloud Function creada con soporte multi-plataforma
- [ ] Frontend básico implementado

### Durante el hackathon
- [ ] Testing con 5+ URLs diferentes (YouTube, Instagram, TikTok, blogs)
- [ ] Flujo completo funcional para todas las plataformas
- [ ] UI pulida
- [ ] Video demo grabado mostrando las 3 plataformas sociales
- [ ] Pitch preparado destacando el soporte multi-plataforma

### Submission
- [ ] Video subido
- [ ] Código en GitHub (opcional)
- [ ] Demo live preparada con ejemplos de cada plataforma
- [ ] Formulario del hackathon completado

---

## 🎉 ¡Buena suerte con el hackathon!

**Recuerda:**
- Focus en el MVP primero: YouTube, Instagram, TikTok + blogs
- Ollama en Cloud Run es más profesional que ngrok
- El pitch es tan importante como el código
- Destaca el soporte multi-plataforma (diferenciador clave)
- Muestra cómo resuelves el problema de Aitum en el contexto moderno (redes sociales)
- Todo tu stack está en Google Cloud (Firebase + Cloud Run = profesional)

**¿Dudas? Revisa las secciones de:**
- Troubleshooting (problemas comunes)
- Testing (URLs de ejemplo para cada plataforma)
- Deployment (checklist de deploy)

---

**Última actualización:** Febrero 2026
**Autor:** Plan generado para hackathon Aitum Bernath
**Proyecto:** What's In My Fridge - React Native
**Soporte:** YouTube 📺 | Instagram 📸 | TikTok 🎵 | Blogs 📰
