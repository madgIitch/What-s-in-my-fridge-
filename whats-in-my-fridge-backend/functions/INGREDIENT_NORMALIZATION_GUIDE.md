# Guía de Normalización de Ingredientes

## Descripción

Este script normaliza ingredientes del archivo `recipes.json` usando Claude AI, generando un vocabulario normalizado para matching con ingredientes escaneados.

## Archivos

### Scripts principales
- **`src/normalizeIngredients.ts`**: Script principal de normalización
- **`scripts/normalize-ingredients.sh`**: Script de ejecución (Linux/Mac)
- **`scripts/normalize-ingredients.bat`**: Script de ejecución (Windows)

### Archivos generados
- **`data/ingredient-normalization-progress.json`**: Progreso de normalización (checkpointing)
- **`data/normalized-ingredients.json`**: Vocabulario normalizado final

## Configuración

### 1. Instalar dependencias

```bash
cd whats-in-my-fridge-backend/functions
npm install @anthropic-ai/sdk
```

### 2. Configurar API Key

#### En Linux/Mac:
```bash
export ANTHROPIC_API_KEY='tu-api-key-aqui'
```

#### En Windows (CMD):
```cmd
set ANTHROPIC_API_KEY=tu-api-key-aqui
```

#### En Windows (PowerShell):
```powershell
$env:ANTHROPIC_API_KEY = "tu-api-key-aqui"
```

### 3. Verificar que recipes.json exista

El script espera encontrar el archivo en:
```
whats-in-my-fridge-backend/functions/data/recipes.json
```

## Ejecución

### Linux/Mac

```bash
cd whats-in-my-fridge-backend/functions
chmod +x scripts/normalize-ingredients.sh
./scripts/normalize-ingredients.sh
```

### Windows

```cmd
cd whats-in-my-fridge-backend\functions
scripts\normalize-ingredients.bat
```

### Directamente con Node.js

```bash
cd whats-in-my-fridge-backend/functions
npm run build
node lib/src/normalizeIngredients.js
```

## Características

### ✅ Checkpointing automático
- Guarda progreso cada 100 ingredientes
- Puede interrumpirse con `Ctrl+C` y reanudar después
- No pierde progreso en caso de error

### 📊 Procesamiento inteligente
- Solo normaliza los **top 1000 ingredientes más frecuentes**
- Procesa en batches de 50 ingredientes
- Reintentos automáticos si falla un batch
- Estadísticas en tiempo real (velocidad, ETA, tasa de éxito)

### 💰 Optimizado para costos
- Usa Claude 3.5 Haiku (modelo más económico)
- Temperatura 0.1 para respuestas consistentes
- ~$0.015 USD por 1000 ingredientes

## Formato de salida

### normalized-ingredients.json

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-01-21T10:30:00.000Z",
  "model": "claude-3-5-haiku-20241022",
  "totalIngredients": 1000,
  "ingredients": {
    "mushroom": {
      "normalized": "mushroom",
      "synonyms": ["mushroom", "champiñón", "champignon", "hongos", "setas"],
      "category": "vegetable",
      "subcategory": "fungi",
      "frequency": 342,
      "embedding": null
    },
    "sausage": {
      "normalized": "sausage",
      "synonyms": ["sausage", "salchicha", "chorizo", "embutido"],
      "category": "meat",
      "subcategory": "processed_meat",
      "frequency": 198,
      "embedding": null
    }
  }
}
```

## Interrumpir y Reanudar

### Interrumpir manualmente
Presiona `Ctrl+C` durante la ejecución. El progreso se guardará automáticamente.

### Reanudar
Simplemente ejecuta el script nuevamente:
```bash
./scripts/normalize-ingredients.sh
```

El script detectará `ingredient-normalization-progress.json` y continuará desde donde se quedó.

### Reiniciar desde cero
Si quieres empezar de nuevo, elimina el archivo de progreso:
```bash
rm data/ingredient-normalization-progress.json
```

## Monitoreo del progreso

Durante la ejecución verás estadísticas como:

```
💾 Progreso guardado: 500/1000
   ✅ Exitosas: 495 | ❌ Errores: 5
   ⏱️  Tiempo: 8.3min | Velocidad: 60.2 ingredientes/min | ETA: 8.3min
   📊 Tasa de éxito: 99.0%
```

## Siguientes pasos

Una vez completada la normalización:

1. **Generar embeddings** (opcional, para matching semántico):
   ```bash
   npm run generate-embeddings
   ```

2. **Subir a Firebase** (para uso en la app):
   ```bash
   # Copiar normalized-ingredients.json a Firestore o Cloud Storage
   ```

3. **Implementar matching en la app** (ver INGREDIENT_NORMALIZATION_STRATEGY.md)

## Solución de problemas

### Error: "ANTHROPIC_API_KEY no está configurado"
Asegúrate de haber configurado la API key como se indica en la sección de configuración.

### Error: "No se encontró recipes.json"
Verifica que el archivo exista en `data/recipes.json` relativo a `functions/`.

### Error: "Rate limit exceeded"
Claude tiene límites de rate. El script tiene pausas entre batches, pero si llegas al límite:
- Espera unos minutos
- Ejecuta nuevamente (continuará desde donde se quedó)

### Error: "Estructura inválida en respuesta"
Ocasionalmente Claude puede devolver JSON malformado. El script:
1. Reintentará el batch completo
2. Si falla, procesará ingredientes uno por uno
3. Continuará con el resto

## Estimación de costos

### Claude 3.5 Haiku
- Input: $0.25 / 1M tokens
- Output: $1.25 / 1M tokens

### Para 1000 ingredientes
- Input tokens: ~20K tokens (listas de ingredientes)
- Output tokens: ~40K tokens (normalizaciones con JSON)
- **Costo total: ~$0.06 USD**

### Tiempo estimado
- ~60 ingredientes/minuto
- **1000 ingredientes: ~17 minutos**

## Notas importantes

1. **Idiomas**: Las normalizaciones incluyen sinónimos en inglés y español
2. **Categorías**: Se asignan automáticamente categorías y subcategorías
3. **Frecuencia**: Se preserva la frecuencia de cada ingrediente en las recetas
4. **Embeddings**: El campo `embedding` se deja como `null` (se llenará en otro script)

## Archivos de ejemplo

### ingredient-normalization-progress.json (checkpoint)
```json
{
  "lastProcessedIndex": 499,
  "successCount": 495,
  "errorCount": 5,
  "startTime": 1737449200000,
  "processedIngredients": ["mushroom", "sausage", ...],
  "normalizations": [...],
  "ingredientFrequency": {
    "mushroom": 342,
    "sausage": 198
  }
}
```

## Contacto

Si tienes problemas o preguntas, consulta:
- [INGREDIENT_NORMALIZATION_STRATEGY.md](../../INGREDIENT_NORMALIZATION_STRATEGY.md) - Estrategia completa
- GitHub Issues
