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

## 📋 Estado del Proyecto en Pasos (actualizado)

### **Paso 1: Infraestructura IA (Cloud Run)**
- ✅ Ollama service desplegado y operativo (`qwen2.5:3b`)
- ✅ Whisper service desplegado y operativo (`faster-whisper base`)
- ✅ Whisper reforzado con `yt-dlp` dentro del contenedor
- ✅ Test real validado: `/transcribe` con URL pública de TikTok (`audio_source: "yt-dlp"`)

### **Paso 2: Parsing de URL en backend (Firebase Functions)**
- ✅ `parseRecipeFromUrl` desplegada y funcionando
- ✅ Entrada por texto manual funcional
- ✅ Salida estructurada con `ingredients + steps`
- ⚠️ YouTube con `youtube-transcript` presenta casos de bloqueo regional/captcha
- 🔄 Pendiente: fallback automático a Whisper (`url social -> yt-dlp -> audio -> transcripción`)

### **Paso 3: Cobertura de redes sociales al 100%**
- 🔄 YouTube: completar fallback robusto
- ✅ TikTok: extracción `metadata + audio` validada end-to-end
- 🔄 Instagram Reels: asegurar extracción `metadata + audio`
- ⏳ Validar con URLs públicas reales por plataforma

### **Paso 4: Integración app + UX de errores**
- ⏳ Mensajes claros en frontend cuando falle una fuente específica
- ⏳ Mostrar al usuario qué estrategia se usó (`transcript`, `scraping`, `whisper`)

### **Paso 5: Validación final de hackathon**
- ⏳ Suite mínima de pruebas E2E por plataforma
- ⏳ Checklist de demo con 1 caso exitoso por fuente

---

## 🚀 Pasos Siguientes INMEDIATOS

### **Paso 1: Deploy final de parseRecipeFromUrl con fallback automático** (10-20 minutos)

```bash
cd whats-in-my-fridge-backend/functions

# Build
npm run build

# Deploy
firebase deploy --only functions:parseRecipeFromUrl
```

### **Paso 2: Testing de regresión por plataforma** (20-30 minutos)

Pruebas recomendadas:

- YouTube: 5 URLs (mínimo 2 sin transcript accesible)
- Instagram Reels: 3 URLs públicas
- TikTok: 3 URLs públicas
- Blogs: 3 URLs

Criterio de éxito: en cada plataforma retorna `rawText` útil, `ingredients` y `steps`.
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

## 🎉 Siguiente Paso AHORA

**Orden recomendado de ejecución:**

```powershell
cd functions
npm run build
firebase deploy --only functions:parseRecipeFromUrl

# 2) Correr testing por plataforma (YouTube, Reels, TikTok, Blogs)
```

---

**Última actualización:** 11 Febrero 2026
**Arquitectura:** Ollama (qwen2.5:3b) + Whisper (faster-whisper base) + yt-dlp
**Plataformas objetivo:** YouTube 📺 | Instagram Reels 📸 | TikTok 🎵 | Blogs 📰
**Estado actual:** Backend devuelve ingredients + steps; TikTok E2E validado; pendiente cierre E2E en YouTube/Reels/Blogs
**Deployment:** Cloud Run + Firebase Functions
