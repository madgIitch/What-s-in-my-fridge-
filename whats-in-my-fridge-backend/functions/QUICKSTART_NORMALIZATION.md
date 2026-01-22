# Quick Start: Normalización de Ingredientes con Ollama

## Pasos rápidos para empezar

### 1. Instalar y configurar Ollama

#### Descargar Ollama
1. Ve a https://ollama.ai/
2. Descarga e instala Ollama para tu sistema operativo
3. Inicia Ollama (debería correr en http://localhost:11434)

#### Descargar modelo
```bash
# Descargar Llama 3.1 8B (recomendado)
ollama pull llama3.1:8b

# O si prefieres un modelo más pequeño/rápido:
ollama pull llama3.2:3b

# O uno más potente:
ollama pull llama3.1:70b
```

Verifica que Ollama esté corriendo:
```bash
curl http://localhost:11434/api/generate -d '{"model":"llama3.1:8b","prompt":"test"}'
```

### 2. Instalar dependencias del proyecto

```bash
cd whats-in-my-fridge-backend/functions
npm install
```

### 3. Ejecutar normalización

#### Opción A: Ejecutar directamente con ts-node (recomendado)

**Windows:**
```cmd
run-normalize.bat
```

**Linux/Mac:**
```bash
npx ts-node src/normalizeIngredients.ts
```

#### Opción B: Compilar y ejecutar

**Windows:**
```cmd
npm run build
node lib\src\normalizeIngredients.js
```

**Linux/Mac:**
```bash
npm run build
node lib/src/normalizeIngredients.js
```

### 4. Monitorear progreso

Durante la ejecución verás:

```
📊 Extrayendo ingredientes únicos del recipes.json...
   ✅ Encontrados 15847 ingredientes únicos

🎯 Top 1000 ingredientes más frecuentes seleccionados
   #1: "salt" (8932 veces)
   #1000: "anise" (12 veces)

🚀 Procesando 1000 ingredientes con llama3.1:8b...
📦 Procesando 20 ingredientes por batch
💾 Guardando progreso cada 100 ingredientes

▶️  Reanudando desde ingrediente 1/1000

[1-20/1000] Procesando batch de 20 ingredientes...
  ✅ 20 ingredientes normalizados

💾 Progreso guardado: 100/1000
   ✅ Exitosas: 98 | ❌ Errores: 2
   ⏱️  Tiempo: 5.2min | Velocidad: 19.2 ingredientes/min | ETA: 46.9min
   📊 Tasa de éxito: 98.0%
```

### 5. Interrumpir y reanudar

- **Interrumpir**: Presiona `Ctrl+C`
- **Reanudar**: Ejecuta el script nuevamente (continuará automáticamente)

### 6. Ver resultados

Cuando termine, encontrarás:

**`data/normalized-ingredients.json`** - Vocabulario normalizado final:
```json
{
  "version": "1.0.0",
  "model": "llama3.1:8b",
  "totalIngredients": 1000,
  "ingredients": {
    "mushroom": {
      "normalized": "mushroom",
      "synonyms": ["mushroom", "champiñón", "setas", "hongos"],
      "category": "vegetable",
      "subcategory": "fungi",
      "frequency": 342,
      "embedding": null
    }
  }
}
```

## Configuración

### Cambiar modelo de Ollama

Edita `src/normalizeIngredients.ts`:

```typescript
const MODEL = "llama3.1:8b"; // Cambia por el modelo que descargaste
```

Modelos disponibles:
- `llama3.2:1b` - Muy rápido, menos preciso
- `llama3.2:3b` - Balance velocidad/precisión
- `llama3.1:8b` - **Recomendado** (balance óptimo)
- `llama3.1:70b` - Muy preciso, más lento
- `mistral:7b` - Alternativa rápida
- `qwen2.5:7b` - Bueno con idiomas

### Cambiar cantidad de ingredientes

```typescript
const TOP_N = 1000; // Cambia este número
```

### Ajustar tamaño de batch

```typescript
const BATCH_SIZE = 20; // Más pequeño = más lento pero más estable
```

### Ajustar timeout

```typescript
const TIMEOUT = 120000; // 120 segundos (ajusta según tu hardware)
```

## Estimaciones

### Tiempo (con Llama 3.1 8B)
- **Hardware**: Depende de tu GPU/CPU
- **Con GPU (RTX 3060)**: ~20-25 ingredientes/min → ~50 minutos para 1000
- **Sin GPU (CPU Intel i7)**: ~5-10 ingredientes/min → ~2 horas para 1000

### Costo
- **100% GRATIS** (todo local, no necesita API keys)
- Solo consume recursos de tu máquina

### Espacio en disco
- Llama 3.1 8B: ~4.7 GB
- Llama 3.2 3B: ~2 GB
- Llama 3.1 70B: ~40 GB

## Solución de problemas

### ❌ "ECONNREFUSED localhost:11434"
→ Ollama no está corriendo. Inicia la aplicación Ollama.

### ❌ "model 'llama3.1:8b' not found"
→ Descarga el modelo: `ollama pull llama3.1:8b`

### ⏱️ "Timeout: Ollama tardó más de 120 segundos"
→ Tu hardware es lento. Aumenta el TIMEOUT o usa un modelo más pequeño:
```typescript
const TIMEOUT = 300000; // 5 minutos
const MODEL = "llama3.2:3b"; // Modelo más rápido
```

### ❌ "Formato de respuesta inesperado"
→ El modelo está devolviendo JSON malformado. El script reintentará automáticamente uno por uno.

### 🐌 Muy lento
→ Opciones:
1. Usa un modelo más pequeño: `llama3.2:3b`
2. Reduce BATCH_SIZE a 10 o 5
3. Reduce TOP_N a 500 o 200
4. Considera usar GPU si tienes una

## Optimización de hardware

### Para máximas con GPU NVIDIA
```bash
# Verifica que Ollama use GPU
ollama run llama3.1:8b
# Debería decir "using GPU"
```

### Para CPUs lentos
```typescript
// En normalizeIngredients.ts
const MODEL = "llama3.2:1b"; // Modelo más ligero
const BATCH_SIZE = 5; // Batches más pequeños
const TOP_N = 200; // Menos ingredientes
```

### Para máquinas potentes
```typescript
const MODEL = "llama3.1:70b"; // Mejor calidad
const BATCH_SIZE = 50; // Batches más grandes
const TOP_N = 5000; // Más ingredientes
```

## Archivos generados

```
whats-in-my-fridge-backend/functions/
├── data/
│   ├── recipes.json                                    ← Input (108MB)
│   ├── ingredient-normalization-progress.json          ← Checkpoint
│   └── normalized-ingredients.json                     ← Output final
└── src/
    └── normalizeIngredients.ts                         ← Script
```

## Comparación: Ollama vs Claude API

| Característica | Ollama (Local) | Claude API |
|---------------|----------------|------------|
| **Costo** | Gratis | ~$0.06 por 1000 |
| **Velocidad** | Depende de hardware | Muy rápido |
| **Precisión** | Buena (Llama 3.1 8B) | Excelente (Haiku) |
| **Internet** | No necesita | Necesita |
| **Setup** | Instalar Ollama + modelo | Solo API key |
| **Privacidad** | 100% local | Envía datos a API |

**Recomendación**:
- Usa **Ollama** si tienes buena máquina y quieres gratuito
- Usa **Claude API** si quieres rapidez y no te importa pagar $0.06

## Próximos pasos

Una vez completada la normalización:

1. **Aplicar ingredientsNormalized a recipes.json**
2. **Generar embeddings** (opcional)
3. **Implementar matching en la app**

## Recursos

- **Ollama**: https://ollama.ai/
- **Modelos disponibles**: https://ollama.ai/library
- **Guía completa**: [INGREDIENT_NORMALIZATION_GUIDE.md](INGREDIENT_NORMALIZATION_GUIDE.md)
- **Estrategia**: [../../INGREDIENT_NORMALIZATION_STRATEGY.md](../../INGREDIENT_NORMALIZATION_STRATEGY.md)
