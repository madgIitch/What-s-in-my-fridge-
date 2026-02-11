# Plan de Adaptación para Hackathon - What's In My Fridge
## **ACTUALIZADO con Whisper + Ollama en Cloud Run**

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
URL → youtube-transcript (subtítulos automáticos) →
Ollama extrae ingredientes → Lista de compras
```

#### **Instagram** 📸
```
URL → Scraping (descripción) + [BONUS: Whisper si hay audio] →
Ollama extrae ingredientes → Lista de compras
```

#### **TikTok** 🎵
```
URL → Scraping (descripción) + [BONUS: Whisper si hay audio] →
Ollama extrae ingredientes → Lista de compras
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

### 2. **Whisper Service** (Transcripción de Audio) [NUEVO]

**Función:** Transcribir audio de videos a texto para extracción de ingredientes

**Especificaciones:**
- **Modelo:** faster-whisper base (150MB)
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

# Instalar faster-whisper y Flask para API
RUN pip install --no-cache-dir \
    faster-whisper==1.0.3 \
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

# Crear API Flask (ver archivo completo en Dockerfile.whisper)
# ...

ENV PORT=8080
EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "2", "--timeout", "300", "whisper_api:app"]
```

**API Endpoints:**
- `GET /health` - Health check
- `POST /transcribe` - Transcribir audio desde URL

**Ejemplo de request:**
```bash
curl -X POST https://whisper-service-XXX.run.app/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://url-del-video-audio.mp3",
    "language": "es"
  }'
```

**Respuesta:**
```json
{
  "text": "Hoy vamos a hacer una pasta carbonara...",
  "language": "es",
  "segments": [...]
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

**Función:** Orquestador principal que coordina scraping, transcripción y extracción

### **Flujo de Procesamiento**

```typescript
// 1. Detectar tipo de URL
const sourceType = detectUrlType(url);

// 2. Extraer contenido según tipo
switch (sourceType) {
  case "youtube":
    // Usar youtube-transcript para subtítulos automáticos
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    rawText = transcript.map(item => item.text).join(" ");
    break;

  case "instagram":
    // Opción A: Scraping de descripción (rápido)
    rawText = await scrapeInstagram(url);

    // Opción B [BONUS]: Si tiene URL de audio, transcribir
    if (hasAudioUrl) {
      const audioText = await transcribeWithWhisper(audioUrl);
      rawText += "\n\n" + audioText;
    }
    break;

  case "tiktok":
    // Similar a Instagram
    rawText = await scrapeTikTok(url);

    // [BONUS]: Transcribir audio si disponible
    if (hasAudioUrl) {
      const audioText = await transcribeWithWhisper(audioUrl);
      rawText += "\n\n" + audioText;
    }
    break;

  case "blog":
    // Web scraping con Cheerio
    rawText = await extractFromBlog(url);
    break;
}

// 3. Extraer ingredientes con Ollama
const ingredients = await extractIngredientsWithOllama(rawText);

// 4. Comparar con inventario del usuario
const { matched, missing } = compareWithInventory(ingredients, userInventory);

// 5. Guardar receta en Firestore
return { recipeId, recipe, matched, missing, matchPercentage };
```

### **Función auxiliar: Transcribir con Whisper**

```typescript
/**
 * Transcribir audio usando Whisper service
 */
async function transcribeWithWhisper(audioUrl: string): Promise<string> {
  const WHISPER_URL = "https://whisper-service-XXX.run.app";

  try {
    const response = await axios.post(`${WHISPER_URL}/transcribe`, {
      url: audioUrl,
      language: "es"
    }, {
      timeout: 120000 // 2 minutos
    });

    return response.data.text;
  } catch (error) {
    console.error("Error transcribiendo audio:", error);
    return ""; // Fallback silencioso
  }
}
```

### **URLs de servicios configuradas**

```typescript
// En parseRecipeFromUrl.ts
const OLLAMA_URL = "https://ollama-service-534730978435.europe-west1.run.app";
const OLLAMA_MODEL = "qwen2.5:3b";

const WHISPER_URL = "https://whisper-service-XXXXXX-ew.a.run.app"; // Obtener después del deploy
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

## 📋 Plan de Implementación ACTUALIZADO

### **✅ COMPLETADO**

1. **Setup de Ollama en Cloud Run**
   - ✅ Dockerfile creado
   - ✅ Build exitoso (~3min)
   - ✅ Deploy a Cloud Run
   - ✅ Testing: qwen2.5:3b funcionando
   - ✅ URL: `https://ollama-service-534730978435.europe-west1.run.app`

2. **Cloud Function parseRecipeFromUrl**
   - ✅ Estructura básica creada
   - ✅ Soporte para YouTube (youtube-transcript)
   - ✅ Soporte para Instagram (scraping)
   - ✅ Soporte para TikTok (scraping)
   - ✅ Soporte para blogs (Cheerio)
   - ✅ Integración con Ollama
   - ✅ Exportada en index.ts

### **🔄 EN PROGRESO**

3. **Setup de Whisper en Cloud Run**
   - ⏳ Dockerfile.whisper creado
   - ⏳ Pendiente: Build de imagen
   - ⏳ Pendiente: Deploy a Cloud Run
   - ⏳ Pendiente: Testing de transcripción

4. **Integración Whisper en parseRecipeFromUrl**
   - ⏳ Pendiente: Agregar función transcribeWithWhisper
   - ⏳ Pendiente: Integrar en flujo de Instagram/TikTok
   - ⏳ Pendiente: Testing end-to-end

### **⏸️ PENDIENTE**

5. **Deploy de Cloud Function**
   - ⏸️ Instalar dependencias (cheerio, youtube-transcript)
   - ⏸️ Build: `npm run build`
   - ⏸️ Deploy: `firebase deploy --only functions:parseRecipeFromUrl`
   - ⏸️ Testing con URLs reales

6. **Frontend React Native**
   - ⏸️ Crear AddRecipeFromUrlScreen
   - ⏸️ Integrar con Cloud Function
   - ⏸️ Mostrar resultados (matched/missing)
   - ⏸️ Generar lista de compras

7. **Testing End-to-End**
   - ⏸️ Probar YouTube (5 videos diferentes)
   - ⏸️ Probar Instagram (3 posts diferentes)
   - ⏸️ Probar TikTok (3 videos diferentes)
   - ⏸️ Probar blogs (3 páginas diferentes)
   - ⏸️ Verificar precisión de extracción

---

## 🚀 Pasos Siguientes INMEDIATOS

### **Paso 1: Deploy de Whisper** (20 minutos)

```bash
cd whats-in-my-fridge-backend

# 1. Build de imagen (~5-8 minutos)
gcloud builds submit --config=cloudbuild.whisper.yaml

# 2. Deploy a Cloud Run (~2 minutos)
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

# 3. Guardar URL del servicio
# Te dará algo como: https://whisper-service-XXXXXX-ew.a.run.app

# 4. Test básico
curl https://whisper-service-XXXXXX-ew.a.run.app/health
# Debería devolver: {"status": "healthy", "model": "whisper-base"}
```

### **Paso 2: Instalar dependencias en Functions** (5 minutos)

```bash
cd whats-in-my-fridge-backend/functions

npm install cheerio youtube-transcript
npm install --save-dev @types/cheerio
```

### **Paso 3: Actualizar parseRecipeFromUrl con URL de Whisper** (2 minutos)

Editar `functions/src/parseRecipeFromUrl.ts`:

```typescript
// Agregar al inicio del archivo
const WHISPER_URL = "https://whisper-service-XXXXXX-ew.a.run.app"; // ← Cambiar XXX
```

### **Paso 4: Build y Deploy de Cloud Function** (10 minutos)

```bash
cd whats-in-my-fridge-backend/functions

# Build
npm run build

# Deploy
firebase deploy --only functions:parseRecipeFromUrl
```

### **Paso 5: Testing** (15 minutos)

Test desde el emulador de Firebase Functions o desde la app:

```typescript
// Test con YouTube
const result1 = await parseRecipeFromUrl({
  url: "https://www.youtube.com/watch?v=XXXXX"
});

// Test con Instagram
const result2 = await parseRecipeFromUrl({
  url: "https://www.instagram.com/p/XXXXX/"
});

// Test con TikTok
const result3 = await parseRecipeFromUrl({
  url: "https://www.tiktok.com/@user/video/XXXXX"
});

// Test con blog
const result4 = await parseRecipeFromUrl({
  url: "https://www.recetasgratis.net/receta-de-paella-valenciana-70337.html"
});
```

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

### **Instagram** (posts públicos)
```
https://www.instagram.com/p/XXXXX/
(Buscar posts de chefs con ingredientes en caption)
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
- [ ] Whisper service deployed ⏳
- [ ] URLs guardadas en código

### **Firebase Functions**
- [x] parseRecipeFromUrl creada ✅
- [ ] Dependencias instaladas (cheerio, youtube-transcript) ⏳
- [ ] Build successful ⏳
- [ ] Deployed to Firebase ⏳
- [ ] Tested con URLs reales ⏳

### **Frontend**
- [ ] AddRecipeFromUrlScreen creada ⏳
- [ ] Integración con Cloud Function ⏳
- [ ] UI para mostrar matched/missing ⏳
- [ ] Shopping list generation ⏳

### **Testing**
- [ ] 5+ URLs de YouTube testeadas ⏳
- [ ] 3+ URLs de Instagram testeadas ⏳
- [ ] 3+ URLs de TikTok testeadas ⏳
- [ ] 3+ URLs de blogs testeadas ⏳
- [ ] Flujo end-to-end validado ⏳

---

## 🎁 Features Bonus (Si sobra tiempo)

1. **Transcripción automática para Instagram/TikTok**
   - Detectar URL de video en Instagram/TikTok
   - Descargar audio con yt-dlp
   - Transcribir con Whisper
   - Combinar con descripción

2. **Caché de recetas**
   - Guardar recetas parseadas en Firestore
   - Evitar re-procesar la misma URL
   - Mostrar "ya parseado" si existe

3. **Mejora de prompts**
   - Fine-tune prompts de Ollama
   - A/B testing de diferentes prompts
   - Optimizar precisión de extracción

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

## 🎉 Siguiente Paso AHORA

**Ejecuta estos comandos para deployar Whisper:**

```powershell
cd whats-in-my-fridge-backend

# 1. Build de Whisper
gcloud builds submit --config=cloudbuild.whisper.yaml

# 2. Deploy de Whisper
gcloud run deploy whisper-service --image gcr.io/what-s-in-my-fridge-a2a07/whisper-service --platform managed --region europe-west1 --memory 2Gi --cpu 2 --timeout 300 --allow-unauthenticated --port 8080 --min-instances 0 --max-instances 2

# 3. Instalar dependencias
cd functions
npm install cheerio youtube-transcript
npm install --save-dev @types/cheerio

# 4. Build y deploy de Cloud Function
npm run build
firebase deploy --only functions:parseRecipeFromUrl
```

---

**Última actualización:** 11 Febrero 2026
**Arquitectura:** Ollama (qwen2.5:3b) + Whisper (faster-whisper base)
**Plataformas soportadas:** YouTube 📺 | Instagram 📸 | TikTok 🎵 | Blogs 📰
**Deployment:** 100% Cloud Run + Firebase Functions
