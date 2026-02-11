# Guía Rápida: Deploy de Ollama a Cloud Run

Esta guía te ayudará a desplegar Ollama en Google Cloud Run en ~30 minutos.

---

## 📋 Requisitos previos

- Proyecto de Firebase ya creado
- Cuenta de Google Cloud (usa la misma del proyecto Firebase)
- Google Cloud SDK instalado: https://cloud.google.com/sdk/docs/install

---

## 🚀 Pasos de Despliegue

### 1. Autenticación y configuración inicial

```bash
# Autenticarse en Google Cloud
gcloud auth login

# Listar tus proyectos
gcloud projects list

# Configurar el proyecto (usa el ID de tu proyecto Firebase)
gcloud config set project whats-in-my-fridge-XXXXX

# Habilitar APIs necesarias
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 2. Crear Dockerfile optimizado

Crear archivo `whats-in-my-fridge-backend/Dockerfile.ollama`:

```dockerfile
FROM ollama/ollama:latest

# Variables de entorno
ENV OLLAMA_HOST=0.0.0.0:8080

# Exponer puerto requerido por Cloud Run
EXPOSE 8080

# Crear script de inicio que descarga el modelo
RUN echo '#!/bin/bash\n\
# Iniciar Ollama en background\n\
ollama serve &\n\
OLLAMA_PID=$!\n\
\n\
# Esperar a que Ollama esté listo\n\
echo "⏳ Esperando a que Ollama inicie..."\n\
sleep 10\n\
\n\
# Descargar modelo\n\
echo "📥 Descargando modelo qwen2.5:7b (esto tarda ~5 min la primera vez)..."\n\
ollama pull qwen2.5:7b\n\
\n\
echo "✅ Modelo descargado. Ollama listo en puerto 8080!"\n\
\n\
# Mantener el contenedor vivo\n\
wait $OLLAMA_PID\n\
' > /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh

# Comando de inicio
CMD ["/usr/local/bin/start.sh"]
```

### 3. Build de la imagen Docker

```bash
# Navegar al directorio backend
cd whats-in-my-fridge-backend

# Build usando Cloud Build (esto tarda ~10 minutos)
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/ollama-service -f Dockerfile.ollama

# Verás output como:
# Creating temporary tarball archive...
# Uploading tarball...
# SUCCESS
```

### 4. Deploy a Cloud Run

```bash
# Deploy del servicio
gcloud run deploy ollama-service \
  --image gcr.io/$(gcloud config get-value project)/ollama-service \
  --platform managed \
  --region europe-west1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 2

# Responder 'Y' cuando pregunte si quieres permitir invocaciones no autenticadas
```

**Salida esperada:**
```
Service [ollama-service] revision [ollama-service-00001-xxx] has been deployed
and is serving 100 percent of traffic.
Service URL: https://ollama-service-XXXXXXXXXX-ew.a.run.app
```

**⚠️ IMPORTANTE:** Guarda la Service URL, la necesitarás después.

### 5. Verificar que funciona

```bash
# Guardar la URL en una variable (reemplaza con tu URL real)
export OLLAMA_URL=https://ollama-service-XXXXXXXXXX-ew.a.run.app

# Test 1: Verificar que Ollama está corriendo
curl $OLLAMA_URL/api/tags

# Deberías ver algo como:
# {"models":[{"name":"qwen2.5:7b",...}]}

# Test 2: Generar texto
curl $OLLAMA_URL/api/generate -d '{
  "model": "qwen2.5:7b",
  "prompt": "Extrae los ingredientes de esta receta: Paella con pollo, arroz y azafrán",
  "stream": false,
  "format": "json"
}'

# Deberías ver un JSON con ingredientes extraídos
```

### 6. Configurar Firebase Functions

```bash
# Navegar al directorio de functions
cd whats-in-my-fridge-backend/functions

# Configurar la URL de Ollama (reemplaza con tu URL real)
firebase functions:config:set ollama.url="https://ollama-service-XXXXXXXXXX-ew.a.run.app"
firebase functions:config:set ollama.model="qwen2.5:7b"

# Verificar configuración
firebase functions:config:get
```

### 7. Actualizar código de Cloud Functions

En `whats-in-my-fridge-backend/functions/src/parseRecipeFromUrl.ts`:

```typescript
// Al inicio del archivo, actualizar:
const OLLAMA_URL = functions.config().ollama?.url || process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = functions.config().ollama?.model || process.env.OLLAMA_MODEL || 'qwen2.5:7b';
```

### 8. Deploy de Firebase Functions

```bash
# Desde el directorio functions
npm run build

# Deploy
firebase deploy --only functions:parseRecipeFromUrl

# Esperar a que termine el deploy (~2 minutos)
```

---

## 💰 Costos Estimados

### Para el hackathon (2 días):
- **Build inicial**: Gratis (300 build-minutos/mes en free tier)
- **Ejecución**: ~$0.50 USD total
  - 50 requests de prueba
  - ~10 segundos por request
  - ~500 segundos de CPU total

### Uso mensual normal (500 requests):
- **Ejecución**: ~$5 USD/mes
- **Almacenamiento de imagen**: ~$0.10/mes

**Total mensual estimado: $5-6 USD**

---

## 🔧 Comandos Útiles

### Ver logs en tiempo real
```bash
gcloud run services logs tail ollama-service --region europe-west1
```

### Ver métricas
```bash
# Abrir Cloud Console
gcloud run services describe ollama-service --region europe-west1

# O en el navegador:
# https://console.cloud.google.com/run
```

### Actualizar el servicio (cambiar configuración)
```bash
gcloud run services update ollama-service \
  --region europe-west1 \
  --memory 8Gi  # Por ejemplo, aumentar memoria
```

### Eliminar el servicio (para ahorrar costos)
```bash
gcloud run services delete ollama-service --region europe-west1
```

---

## 🐛 Troubleshooting

### Problema: "Container failed to start"
```bash
# Ver logs detallados
gcloud run services logs read ollama-service --region europe-west1 --limit 50

# El modelo puede tardar en descargarse
# Espera ~5-10 minutos en el primer deploy
```

### Problema: "Out of memory"
```bash
# Aumentar memoria a 8Gi
gcloud run services update ollama-service \
  --region europe-west1 \
  --memory 8Gi
```

### Problema: "Timeout después de 3600s"
```bash
# Esto significa que el contenedor tardó más de 1 hora en iniciar
# Solución: Preconstruir la imagen con el modelo ya incluido
# (Ver sección de optimización abajo)
```

### Problema: "Cloud Function no puede conectar a Ollama"
```bash
# Verificar que la URL está bien configurada
firebase functions:config:get

# Verificar que Cloud Run está corriendo
gcloud run services describe ollama-service --region europe-west1

# Verificar que allow-unauthenticated está habilitado
# (debe aparecer "allUsers" en invoker permissions)
```

---

## ⚡ Optimización (Opcional)

### Pre-cargar el modelo en la imagen (build más rápido después)

Modificar `Dockerfile.ollama`:

```dockerfile
FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:8080
EXPOSE 8080

# Iniciar Ollama temporalmente para descargar modelo
RUN ollama serve & \
    sleep 10 && \
    ollama pull qwen2.5:7b && \
    pkill ollama

# Script simplificado (modelo ya está descargado)
RUN echo '#!/bin/bash\n\
ollama serve\n\
' > /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh

CMD ["/usr/local/bin/start.sh"]
```

**Ventajas:**
- Inicia en ~30 segundos (vs 5 minutos)
- Más confiable

**Desventajas:**
- Build inicial tarda más (~15 minutos)
- Imagen más grande (~5GB)

---

## 📊 Monitoreo

### Ver uso en tiempo real

1. **Cloud Console:**
   - https://console.cloud.google.com/run
   - Click en "ollama-service"
   - Ver métricas de CPU, memoria, requests

2. **Desde terminal:**
```bash
# Ver requests totales
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ollama-service" \
  --limit 10 \
  --format json

# Ver errores
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ollama-service AND severity>=ERROR" \
  --limit 10
```

---

## ✅ Checklist Final

- [ ] Google Cloud SDK instalado
- [ ] Autenticado en gcloud
- [ ] Proyecto configurado
- [ ] APIs habilitadas
- [ ] Dockerfile creado
- [ ] Imagen buildeada exitosamente
- [ ] Servicio desplegado en Cloud Run
- [ ] URL del servicio guardada
- [ ] Test con curl exitoso
- [ ] Firebase Functions configuradas
- [ ] Cloud Function desplegada
- [ ] Test end-to-end desde la app funciona

---

## 🎯 Próximos pasos

Una vez que Cloud Run esté funcionando:

1. ✅ Continuar con el desarrollo del frontend
2. ✅ Implementar las funciones de scraping (YouTube, Instagram, TikTok)
3. ✅ Testing con URLs reales
4. ✅ Crear la pantalla de Shopping List
5. ✅ Preparar el video demo

---

## 📞 Soporte

Si tienes problemas:

1. **Revisar logs:**
   ```bash
   gcloud run services logs tail ollama-service --region europe-west1
   ```

2. **Verificar estado del servicio:**
   ```bash
   gcloud run services describe ollama-service --region europe-west1
   ```

3. **Cloud Console:**
   - https://console.cloud.google.com/run
   - https://console.cloud.google.com/logs

---

**¡Listo!** Ahora tienes Ollama corriendo en Cloud Run de forma profesional y escalable 🚀
