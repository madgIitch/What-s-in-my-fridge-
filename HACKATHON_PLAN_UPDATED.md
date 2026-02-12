# Plan de Adaptación para Hackathon - What's In My Fridge
## **ACTUALIZADO con yt-dlp + Whisper + Ollama en Cloud Run**

**Hackathon:** Propuesta de Aitum Bernath
**Tiempo disponible:** 1.5 días
**Objetivo:** De "ver una receta en redes sociales" a "cocinarla realmente"

---

## 🏗️ Arquitectura del Sistema

### **Servicios en Cloud Run (Google Cloud)**

```
┌──────────────────────────────────────────────────────────┐
│                     Google Cloud                         │
│                                                          │
│  ┌────────────────────┐  ┌─────────────────────┐       │
│  │  Cloud Run         │  │  Cloud Run          │       │
│  │  ollama-service    │  │  whisper-service    │       │
│  │                    │  │                     │       │
│  │  - qwen2.5:3b      │  │  - faster-whisper   │       │
│  │  - Extracción de   │  │  - Modelo: base     │       │
│  │    ingredientes    │  │  - Transcripción    │       │
│  │  - Puerto: 8080    │  │    de audio         │       │
│  │  - Mem: 4Gi        │  │  - Puerto: 8080     │       │
│  │                    │  │  - Mem: 2Gi         │       │
│  └────────────────────┘  └─────────────────────┘       │
│           ▲                        ▲                    │
│           │                        │                    │
│           └────────────┬───────────┘                    │
│                        │                                │
│              ┌─────────▼───────────┐                    │
│              │ Firebase Functions  │                    │
│              │  parseRecipeFromUrl │                    │
│              │                     │                    │
│              │  - Región: EU-W1    │                    │
│              │  - Mem: 512MB       │                    │
│              └─────────┬───────────┘                    │
│                        │                                │
└────────────────────────┼────────────────────────────────┘
                         │
                         │ HTTPS Callable
                         ▼
              ┌─────────────────────┐
              │  React Native App   │
              │                     │
              │  - Frontend UI      │
              │  - Usuario pega URL │
              └─────────────────────┘
```

### **Flujo Completo por Plataforma**

#### **YouTube** 📺
```
URL → Intento 1: youtube-transcript (rápido) →
Si falla: Whisper Service (yt-dlp descarga audio) →
Ollama extrae ingredientes → Lista de compras
```

#### **Instagram Reels** 📸
```
URL → Scraping de caption/metadata + Whisper Service (yt-dlp audio) →
Combinar texto → Ollama extrae ingredientes → Lista de compras
```

#### **TikTok** 🎵
```
URL → Scraping de descripción/metadata + Whisper Service (yt-dlp audio) →
Combinar texto → Ollama extrae ingredientes → Lista de compras
```

#### **Blogs** 📰
```
URL → Cheerio scraping (HTML) →
Ollama extrae ingredientes → Lista de compras
```

---

## 🤖 Servicios de IA en Cloud Run

### 1. **Ollama Service** (Extracción de Ingredientes)

**Función:** Análisis de texto y extracción estructurada de ingredientes

**Especificaciones:**
- **Modelo:** qwen2.5:3b (2GB, optimizado para español y JSON)
- **Memoria:** 4Gi
- **CPU:** 2 vCPUs
- **Puerto:** 8080
- **Región:** europe-west1
- **Cold start:** ~10-15 segundos
- **Tiempo de respuesta:** ~5-10 segundos

**Dockerfile:** `Dockerfile.ollama`

```dockerfile
FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:8080
ENV PORT=8080

EXPOSE 8080

# Pre-descargar modelo durante build (~3-4 minutos)
RUN ollama serve & \
    pid=$! && \
    echo "Esperando a que Ollama inicie..." && \
    sleep 15 && \
    echo "Descargando modelo qwen2.5:3b..." && \
    ollama pull qwen2.5:3b && \
    echo "Modelo descargado exitosamente" && \
    kill $pid && \
    wait $pid || true

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/tags || exit 1

ENTRYPOINT []
CMD ["ollama", "serve"]
```

**Deploy:**
```bash
# Build (tarda ~3-4 minutos)
gcloud builds submit --config=cloudbuild.yaml

# Deploy
gcloud run deploy ollama-service \
  --image gcr.io/what-s-in-my-fridge-a2a07/ollama-service \
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

**Costos estimados:**
- Hackathon (50 requests): ~$0.30 USD
- Mensual (500 requests): ~$3 USD

---

### 2. **Whisper Service** (Transcripción de Audio + URL social)

**Función:** Transcribir audio de videos para extracción de ingredientes, aceptando URL de audio directo o URL social (YouTube/TikTok/Instagram Reels).

**Especificaciones:**
- **Modelo:** faster-whisper base (150MB)
- **Descarga de audio:** yt-dlp
- **Memoria:** 2Gi
- **CPU:** 2 vCPUs
- **Puerto:** 8080
- **Región:** europe-west1
- **Cold start:** ~5-8 segundos
- **Tiempo de transcripción:** ~10-15 segundos por video de 3 minutos

**Dockerfile:** `Dockerfile.whisper`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar faster-whisper, yt-dlp y Flask para API
RUN pip install --no-cache-dir \
    faster-whisper==1.0.3 \
    yt-dlp==2026.* \
    flask==3.0.0 \
    gunicorn==21.2.0 \
    requests==2.31.0

# Pre-descargar modelo durante build (~2-3 minutos)
RUN python3 << 'EOF'
from faster_whisper import WhisperModel
print("📥 Descargando modelo Whisper 'base'...")
model = WhisperModel("base", device="cpu", compute_type="int8")
print("✅ Modelo descargado exitosamente")
EOF

# Copiar API Flask
COPY whisper_api.py /app/whisper_api.py

ENV PORT=8080
EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "2", "--timeout", "300", "whisper_api:app"]
```

**API Endpoints (actualizados):**
- `GET /health` - Health check
- `POST /transcribe` - Transcribir desde URL de audio o URL social

**Ejemplo de request:**
```bash
curl -X POST https://whisper-service-XXX.run.app/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.tiktok.com/@user/video/XXXXX",
    "language": "es"
  }'
```

**Respuesta:**
```json
{
  "text": "Hoy vamos a hacer una pasta carbonara...",
  "language": "es",
  "segments": [...],
  "audio_source": "yt-dlp"
}
```

**Deploy:**
```bash
# Build (tarda ~5-8 minutos)
gcloud builds submit --config=cloudbuild.whisper.yaml

# Deploy
gcloud run deploy whisper-service \
  --image gcr.io/what-s-in-my-fridge-a2a07/whisper-service \
  --platform managed \
  --region europe-west1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 2
```

**Costos estimados:**
- Hackathon (20 transcripciones): ~$0.20 USD
- Mensual (200 transcripciones): ~$2 USD

**¿Por qué faster-whisper?**
- ✅ 4-6x más rápido que Whisper original
- ✅ Funciona perfectamente en CPU
- ✅ Modelo "base" preciso para español
- ✅ 500MB RAM durante inferencia
- ✅ Gratis (sin API keys)
- ✅ Fácil integración con Flask HTTP API

---

## 💻 Cloud Function: parseRecipeFromUrl

**Ubicación:** `functions/src/parseRecipeFromUrl.ts`

**Función:** Orquestador principal que coordina scraping, transcripción y extracción de `ingredients + steps`

### **Flujo de Procesamiento (actualizado)**

```typescript
// 1. Detectar tipo de URL
const sourceType = detectUrlType(url);

// 2. Extraer metadata base por plataforma (title/caption/description)
const socialText = await extractSocialMetadata(url, sourceType);

// 3. Obtener transcripción con fallback robusto
let transcriptText = "";
if (["youtube", "instagram", "tiktok"].includes(sourceType)) {
  // YouTube: intento rápido con youtube-transcript
  // Si falla o retorna vacío -> fallback a Whisper (yt-dlp dentro del servicio)
  transcriptText = await getTranscriptWithFallback(url, sourceType);
}

// 4. Combinar texto de metadata + transcripción
const rawText = [socialText, transcriptText].filter(Boolean).join("\n\n");

// 5. Extraer ingredientes con Ollama
const ingredients = await extractIngredientsWithOllama(rawText);

// 6. Extraer pasos con Ollama
const steps = await extractStepsWithOllama(rawText);

// 7. Respuesta final
return { ingredients, steps, sourceType, rawText, recipeTitle };
```

### **Función auxiliar: Fallback de transcripción**

```typescript
/**
 * 1) Intenta youtube-transcript (solo YouTube)
 * 2) Si falla, usa Whisper Service con la URL original
 */
async function getTranscriptWithFallback(url: string, sourceType: string): Promise<string> {
  try {
    if (sourceType === "youtube") {
      const transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "es" });
      const text = transcript.map(item => item.text).join(" ").trim();
      if (text.length > 50) return text;
    }
  } catch (error) {
    console.warn("youtube-transcript falló, usando Whisper fallback");
  }

  const response = await axios.post(`${WHISPER_URL}/transcribe`, {
    url,
    language: "es"
  }, { timeout: 180000 });

  return response.data.text || "";
}
```

### **URLs de servicios configuradas**

```typescript
// En parseRecipeFromUrl.ts
const OLLAMA_URL = "https://ollama-service-534730978435.europe-west1.run.app";
const OLLAMA_MODEL = "qwen2.5:3b";
const WHISPER_URL = "https://whisper-service-534730978435.europe-west1.run.app";
```

### **Comportamiento esperado por plataforma**
- `youtube`: `youtube-transcript` primero; si falla, fallback a Whisper + yt-dlp.
- `instagram` (incluye reels): metadata + transcripción de audio.
- `tiktok`: metadata + transcripción de audio.
- `blog`: scraping HTML directo (sin Whisper).

### **Contrato de respuesta actual**

```json
{
  "ingredients": ["..."],
  "steps": ["..."],
  "sourceType": "tiktok",
  "rawText": "...",
  "recipeTitle": "..."
}
```

---

## 📦 Instalación de Dependencias

### **Backend (Firebase Functions)**

```bash
cd whats-in-my-fridge-backend/functions

# Dependencias para scraping y transcripción
npm install cheerio youtube-transcript

# Dev dependencies (tipos)
npm install --save-dev @types/cheerio
```

### **Dependencias instaladas:**
- `cheerio` - Web scraping de HTML
- `youtube-transcript` - Extracción de subtítulos de YouTube
- `axios` - HTTP requests (ya instalado)
- `@types/cheerio` - Tipos TypeScript

---

## 📋 Estado del Proyecto (ACTUALIZADO)

### **✅ BACKEND COMPLETADO (11 Feb 2026)**

#### **Infraestructura IA (Cloud Run)**
- ✅ Ollama service desplegado y operativo (`qwen2.5:3b`)
- ✅ Whisper service desplegado y operativo (`faster-whisper base + yt-dlp`)
- ✅ Ambos servicios testeados y validados

#### **Cloud Function: parseRecipeFromUrl**
- ✅ Desplegada y funcionando
- ✅ Extracción de `ingredients + steps` con Ollama
- ✅ Prompts optimizados para transcripciones de video (inglés/español)
- ✅ Límites aumentados (3000 chars para ingredientes, 4000 para pasos)
- ✅ Fallback automático YouTube → Whisper
- ✅ Instagram Reels validado con caso real (metadata + audio → pasos completos)
- ✅ TikTok funcional (metadata + audio)
- ✅ Blogs funcional (scraping HTML)

#### **Contrato Backend → Frontend**
```typescript
type ParseRecipeFromUrlResult = {
  ingredients: string[];     // ["potatoes", "eggs", "olive oil", ...]
  steps: string[];           // ["Peel the potatoes", "Heat the oil", ...]
  sourceType: "youtube" | "instagram" | "tiktok" | "blog" | "manual";
  rawText: string;           // Transcripción completa (para debugging)
  recipeTitle?: string;      // "Spanish Tortilla Recipe"
};
```

---

### **🔄 FRONTEND EN PROGRESO**

#### **Objetivo:** Pantalla de "Add Recipe from URL"

**User Story:**
> Como usuario, quiero pegar una URL de YouTube/Instagram/TikTok/Blog y que la app extraiga automáticamente los ingredientes y pasos, me muestre cuáles tengo en mi nevera, y me permita guardar la receta.

**Flujo UX:**
1. Usuario abre pantalla "Add Recipe"
2. Ve dos opciones:
   - 📝 "Manual Entry" (existente)
   - 🔗 **"From URL" (NUEVO)**
3. Usuario pega URL de video/blog
4. App muestra loading (~20-30 seg)
5. App muestra resultado:
   - ✅ Ingredientes extraídos (con match vs inventario)
   - ✅ Pasos de preparación
   - ℹ️ Fuente detectada (YouTube/Instagram/TikTok/Blog)
6. Usuario puede:
   - Editar ingredientes/pasos
   - Guardar receta en Firestore
   - Ver qué ingredientes le faltan → Lista de compras

---

## 🎨 PLAN DE INTEGRACIÓN FRONTEND

### **Fase 1: Setup y Estructura (30-45 min)**

#### 1.1. Crear componente de pantalla
```bash
# Ubicación sugerida
whats-in-my-fridge/src/screens/AddRecipeFromUrlScreen.tsx
```

#### 1.2. Estructura de la pantalla
```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, ActivityIndicator, ScrollView, Text } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface ParseRecipeFromUrlResult {
  ingredients: string[];
  steps: string[];
  sourceType: "youtube" | "instagram" | "tiktok" | "blog" | "manual";
  rawText: string;
  recipeTitle?: string;
}

export default function AddRecipeFromUrlScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseRecipeFromUrlResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParseUrl = async () => {
    // Llamar a Firebase Function
    // Mostrar resultado
    // Permitir edición y guardado
  };

  return (
    <ScrollView>
      {/* Input de URL */}
      {/* Loading indicator */}
      {/* Resultado con ingredientes y pasos */}
      {/* Botón de guardar */}
    </ScrollView>
  );
}
```

---

### **Fase 2: Integración con Firebase Function (20-30 min)**

#### 2.1. Configurar llamada a Cloud Function
```typescript
const functions = getFunctions();
const parseRecipeFromUrl = httpsCallable<
  { url: string; manualText?: string },
  ParseRecipeFromUrlResult
>(functions, 'parseRecipeFromUrl');

const handleParseUrl = async () => {
  if (!url.trim()) {
    setError('Please enter a valid URL');
    return;
  }

  setLoading(true);
  setError(null);
  setResult(null);

  try {
    const response = await parseRecipeFromUrl({ url: url.trim() });
    setResult(response.data);
  } catch (err: any) {
    setError(err.message || 'Failed to parse recipe. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

#### 2.2. Manejo de estados
- **Loading:** Mostrar spinner + mensaje "Analyzing video... (20-30 sec)"
- **Success:** Mostrar ingredientes + pasos extraídos
- **Error:** Mostrar mensaje de error con sugerencias

---

### **Fase 3: UI de Resultado (30-45 min)**

#### 3.1. Sección de ingredientes extraídos
```typescript
{result && (
  <View style={styles.resultContainer}>
    {/* Header */}
    <Text style={styles.recipeTitle}>
      {result.recipeTitle || 'Recipe'}
    </Text>
    <Text style={styles.sourceType}>
      Source: {result.sourceType}
    </Text>

    {/* Ingredientes */}
    <Text style={styles.sectionTitle}>
      Ingredients ({result.ingredients.length})
    </Text>
    {result.ingredients.map((ingredient, index) => (
      <View key={index} style={styles.ingredientRow}>
        <Text>{ingredient}</Text>
        {/* TODO: Mostrar si el usuario lo tiene en inventario */}
      </View>
    ))}

    {/* Pasos */}
    <Text style={styles.sectionTitle}>
      Steps ({result.steps.length})
    </Text>
    {result.steps.map((step, index) => (
      <View key={index} style={styles.stepRow}>
        <Text>{index + 1}. {step}</Text>
      </View>
    ))}
  </View>
)}
```

#### 3.2. Match con inventario del usuario
```typescript
// Obtener inventario del usuario desde Firestore
const [userInventory, setUserInventory] = useState<string[]>([]);

useEffect(() => {
  // Fetch user inventory from Firestore
  // const inventory = await getUserInventory(userId);
  // setUserInventory(inventory);
}, []);

// Comparar ingredientes extraídos con inventario
const matchedIngredients = result.ingredients.filter(ing =>
  userInventory.some(inv =>
    inv.toLowerCase().includes(ing.toLowerCase()) ||
    ing.toLowerCase().includes(inv.toLowerCase())
  )
);

const missingIngredients = result.ingredients.filter(ing =>
  !matchedIngredients.includes(ing)
);
```

---

### **Fase 4: Guardar Receta en Firestore (20-30 min)**

#### 4.1. Estructura de datos en Firestore
```typescript
interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  sourceType: string;
  sourceUrl?: string;
  createdAt: Date;
  userId: string;
}
```

#### 4.2. Función de guardado
```typescript
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const handleSaveRecipe = async () => {
  if (!result) return;

  try {
    await addDoc(collection(db, 'recipes'), {
      title: result.recipeTitle || 'Untitled Recipe',
      ingredients: result.ingredients,
      steps: result.steps,
      sourceType: result.sourceType,
      sourceUrl: url,
      createdAt: Timestamp.now(),
      userId: currentUser.uid,
    });

    // Navegar de vuelta o mostrar éxito
    navigation.goBack();
  } catch (error) {
    console.error('Error saving recipe:', error);
    setError('Failed to save recipe');
  }
};
```

---

### **Fase 5: Navegación e Integración (15-20 min)**

#### 5.1. Agregar ruta en navegador
```typescript
// En tu Stack Navigator
<Stack.Screen
  name="AddRecipeFromUrl"
  component={AddRecipeFromUrlScreen}
  options={{ title: 'Add Recipe from URL' }}
/>
```

#### 5.2. Botón en pantalla principal
```typescript
// En HomeScreen o RecipesScreen
<Button
  title="Add Recipe from URL"
  onPress={() => navigation.navigate('AddRecipeFromUrl')}
/>
```

---

### **Fase 6: Polish & UX (20-30 min)**

#### 6.1. Mejoras UX
- ✅ Placeholder en input: "Paste YouTube, Instagram, TikTok, or blog URL"
- ✅ Validación de URL antes de enviar
- ✅ Loading con mensaje específico: "Analyzing video... This may take 20-30 seconds"
- ✅ Iconos por tipo de fuente (📺 YouTube, 📸 Instagram, 🎵 TikTok, 📰 Blog)
- ✅ Chips visuales para ingredientes: Verde (tengo) / Rojo (falta)
- ✅ Botón "Add to Shopping List" para ingredientes faltantes

#### 6.2. Manejo de errores mejorado
```typescript
const getErrorMessage = (error: any): string => {
  if (error.message.includes('unauthenticated')) {
    return 'Please log in to use this feature';
  }
  if (error.message.includes('No se pudo extraer texto')) {
    return 'Could not extract recipe from this URL. Try a different video or use manual entry.';
  }
  return 'Something went wrong. Please try again or use manual entry.';
};
```

---

## 🚀 Pasos de Implementación (Orden Sugerido)

### **Día 1 - Tarde (3-4 horas)**

1. **Setup básico (45 min)**
   - Crear `AddRecipeFromUrlScreen.tsx`
   - Estructura básica con input y botón
   - Integrar en navegación

2. **Integración con Firebase Function (30 min)**
   - Configurar llamada a `parseRecipeFromUrl`
   - Manejo de loading/error/success

3. **UI de resultado básica (1 hora)**
   - Mostrar ingredientes extraídos
   - Mostrar pasos de preparación
   - Styling básico

4. **Match con inventario (45 min)**
   - Fetch inventario del usuario
   - Comparar ingredientes
   - Visual feedback (colores/chips)

5. **Guardar en Firestore (30 min)**
   - Función de guardado
   - Navegación post-guardado

6. **Testing & debugging (30 min)**
   - Probar con URL real de cada plataforma
   - Fix bugs menores

---

## ✅ Checklist de Deployment ACTUALIZADO

### **Cloud Run Services**
- [x] Ollama service deployed ✅
- [x] Whisper service deployed ✅
- [x] Whisper actualizado con `yt-dlp` ✅
- [x] URLs guardadas en código base ✅
- [x] Testing validado por plataforma ✅

### **Firebase Functions**
- [x] parseRecipeFromUrl creada ✅
- [x] Integración con Ollama ✅
- [x] Respuesta con `ingredients + steps` ✅
- [x] Fallback automático YouTube → Whisper ✅
- [x] Integración metadata + audio para TikTok ✅
- [x] Integración metadata + audio para Instagram Reels ✅
- [x] Prompts optimizados para video transcriptions ✅
- [x] Build + deploy final completado ✅

### **Frontend (React Native App)**
- [ ] Crear `AddRecipeFromUrlScreen.tsx` ⏳
- [ ] Integración con Firebase Function ⏳
- [ ] UI de resultado (ingredientes + pasos) ⏳
- [ ] Match con inventario del usuario ⏳
- [ ] Guardar receta en Firestore ⏳
- [ ] Navegación e integración ⏳
- [ ] Polish & UX improvements ⏳
- [ ] Testing E2E con URLs reales ⏳

---

## 💰 Costos Totales Estimados

### **Durante el Hackathon (1.5 días)**

| Servicio | Requests | Tiempo activo | Costo |
|----------|----------|---------------|-------|
| Ollama (qwen2.5:3b) | ~50 | ~10 min | $0.30 |
| Whisper (faster-whisper) | ~20 | ~5 min | $0.20 |
| Cloud Functions | ~70 | - | $0.01 |
| **TOTAL HACKATHON** | | | **~$0.51 USD** |

### **Post-Hackathon (uso mensual moderado)**

| Servicio | Requests/mes | Costo/mes |
|----------|--------------|-----------|
| Ollama | ~500 | $3.00 |
| Whisper | ~200 | $2.00 |
| Cloud Functions | ~700 | $0.10 |
| **TOTAL MENSUAL** | | **~$5.10 USD/mes** |

**Con `min-instances=0`:**
- ✅ Solo pagas cuando hay requests
- ✅ Se apaga automáticamente
- ✅ Costos predecibles

---

## 🎯 Comparación: faster-whisper vs whisper.cpp

| Característica | faster-whisper (ELEGIDO) | whisper.cpp |
|---|---|---|
| **Velocidad** | 4-6x más rápido | 5-10x más rápido |
| **RAM** | 500MB-1GB | 300-500MB |
| **Facilidad deploy** | ⭐⭐⭐⭐⭐ Simple | ⭐⭐⭐ Moderado |
| **Integración** | ⭐⭐⭐⭐⭐ HTTP API simple | ⭐⭐ Requiere wrapper |
| **Dockerfile** | Simple (30 líneas) | Complejo (50+ líneas) |
| **Debugging** | Fácil (Python) | Difícil (C++) |
| **Mantenimiento** | Fácil | Moderado |

**Decisión:** faster-whisper porque el tiempo de implementación es crítico para el hackathon.

---

## 📊 Métricas de Rendimiento

### **Tiempos de respuesta esperados:**

| Operación | Tiempo |
|-----------|--------|
| YouTube (con transcript) | 5-10 seg |
| Instagram (scraping) | 3-5 seg |
| Instagram (scraping + Whisper) | 15-20 seg |
| TikTok (scraping) | 3-5 seg |
| TikTok (scraping + Whisper) | 15-20 seg |
| Blog (scraping) | 3-7 seg |
| Ollama (extracción) | 5-10 seg |
| Whisper (transcripción 3min) | 10-15 seg |

**Tiempo total del flujo completo:**
- **Rápido** (sin audio): 10-20 segundos
- **Con transcripción**: 20-30 segundos

---

## 🧪 URLs de Testing

### **YouTube** (con subtítulos automáticos)
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
(Buscar videos de recetas en español con subtítulos automáticos)
```

### **Instagram Reels** (públicos)
```
https://www.instagram.com/reel/XXXXX/
(Buscar reels de recetas con audio y caption)
```

### **TikTok** (videos públicos)
```
https://www.tiktok.com/@user/video/XXXXX
(Buscar recetas con ingredientes en descripción)
```

### **Blogs de recetas**
```
https://www.recetasgratis.net/receta-de-paella-valenciana-70337.html
https://www.directoalpaladar.com/recetas-de-carnes-y-aves/pollo-al-ajillo
```

---

## ✅ Checklist de Deployment

### **Cloud Run Services**
- [x] Ollama service deployed ✅
- [x] Whisper service deployed ✅
- [x] Whisper actualizado con `yt-dlp` ✅
- [x] URLs guardadas en código base
- [x] Test TikTok en `/transcribe` exitoso (`audio_source: "yt-dlp"`) ✅

### **Firebase Functions**
- [x] parseRecipeFromUrl creada ✅
- [x] Integración con Ollama ✅
- [x] Respuesta con `ingredients + steps` ✅
- [ ] Fallback automático YouTube -> Whisper
- [x] Integración metadata + audio para TikTok ✅
- [ ] Integración metadata + audio para Reels
- [ ] Build + deploy final de parseRecipeFromUrl

### **Testing técnico**
- [ ] 5+ URLs de YouTube testeadas (incluyendo casos bloqueados) ⏳
- [ ] 3+ URLs de Instagram Reels testeadas ⏳
- [x] TikTok testeado con éxito en backend (ingredients + steps) ✅
- [ ] 3+ URLs de blogs testeadas ⏳
- [ ] Flujo end-to-end validado ⏳

---

## 🎁 Features Bonus (Si sobra tiempo)

1. **Caché de recetas parseadas por URL**
   - Guardar recetas parseadas en Firestore
   - Evitar re-procesar la misma URL
   - Reducir latencia y costo

2. **Normalización post-Ollama**
   - Unificar sinónimos de ingredientes
   - Mejorar match con inventario

3. **Observabilidad**
   - Loggear estrategia usada (`transcript`, `scraping`, `whisper_yt_dlp`)
   - Medir tasa de éxito por plataforma

---

## 📚 Archivos del Proyecto

```
whats-in-my-fridge-backend/
├── Dockerfile.ollama                    ✅ Creado
├── Dockerfile.whisper                   ✅ Creado
├── cloudbuild.yaml                      ✅ Creado
├── cloudbuild.whisper.yaml              ✅ Creado
└── functions/
    ├── package.json                     ⏳ Pendiente actualizar
    ├── src/
    │   ├── index.ts                     ✅ Actualizado
    │   └── parseRecipeFromUrl.ts        ✅ Creado
    └── ...
```

---

## 🎉 SIGUIENTE PASO: FRONTEND INTEGRATION

### **Paso 1: Crear estructura base (ahora)**
```bash
# Crear archivo de pantalla
touch whats-in-my-fridge/src/screens/AddRecipeFromUrlScreen.tsx

# Estructura básica con:
# - Input para URL
# - Botón de "Analyze"
# - Loading state
# - Resultado (ingredientes + pasos)
```

### **Paso 2: Integrar con Firebase Function**
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const parseRecipeFromUrl = httpsCallable(functions, 'parseRecipeFromUrl');

// Llamar con { url: "https://..." }
```

### **Paso 3: Mostrar resultado y guardar**
- Mostrar ingredientes con match vs inventario
- Mostrar pasos de preparación
- Botón para guardar en Firestore
- Navegación de vuelta

---

## 📊 Estimación de Tiempo

| Fase | Duración | Prioridad |
|------|----------|-----------|
| Setup básico | 45 min | 🔴 Critical |
| Integración Firebase | 30 min | 🔴 Critical |
| UI de resultado | 1 hora | 🔴 Critical |
| Match con inventario | 45 min | 🟡 Important |
| Guardar en Firestore | 30 min | 🔴 Critical |
| Polish & UX | 30 min | 🟢 Nice-to-have |
| **TOTAL** | **~4 horas** | |

---

**Última actualización:** 11 Febrero 2026 - 23:30
**Backend Status:** ✅ COMPLETADO Y VALIDADO
**Frontend Status:** 🔄 EN PROGRESO
**Arquitectura:** Ollama (qwen2.5:3b) + Whisper (faster-whisper base + yt-dlp)
**Plataformas soportadas:** YouTube 📺 | Instagram Reels 📸 | TikTok 🎵 | Blogs 📰
**Próximo hito:** Pantalla "Add Recipe from URL" funcional en app
