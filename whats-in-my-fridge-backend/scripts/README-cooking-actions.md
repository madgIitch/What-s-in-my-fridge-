# Extractor de Acciones de Cocina 🍳

Este script usa **Ollama** (LLM local) para analizar todas las recetas y extraer las acciones principales de cocina que puedes usar para crear animaciones de Neverito.

## Requisitos Previos

### ✅ Ya tienes todo listo!

Ya tienes Ollama instalado con estos modelos:
- **llama3.1:8b** (4.9 GB) - El que usaremos por defecto ⭐
- qwen2.5-coder:7b-instruct (4.7 GB)
- deepseek-coder:6.7b-instruct (3.8 GB)
- llama3.2:3b (2.0 GB)

El script está configurado para usar **llama3.1:8b** automáticamente.

### Verificar que Ollama esté corriendo

```bash
# Ollama debería estar corriendo automáticamente
# Puedes verificar con:
ollama list
```

Si no está corriendo, ejecuta:
```bash
ollama serve
```

## Uso

### Ejecutar el script

Desde el directorio `whats-in-my-fridge-backend`:

```bash
node scripts/extract-cooking-actions.js
```

### Lo que hace el script:

1. ✅ Verifica que Ollama esté corriendo
2. 📖 Lee el archivo `data/recipes-with-normalized.json`
3. 🤖 Por cada receta, usa Ollama para analizar las instrucciones
4. 🎯 Extrae las acciones principales de cocina (verbos)
5. 📊 Cuenta la frecuencia de cada acción
6. 💾 Guarda el resultado en `data/cooking-actions.json`

### Salida esperada:

El script procesará todas las recetas y mostrará:
- Progreso en tiempo real
- Total de acciones únicas encontradas
- Top 20 acciones más frecuentes
- Archivo JSON con todas las acciones

### Formato del archivo de salida

`data/cooking-actions.json` contendrá:

```json
{
  "totalRecipesProcessed": 1500,
  "totalUniqueActions": 120,
  "generatedAt": "2025-01-XX...",
  "model": "llama2",
  "actions": [
    {
      "action": "mezclar",
      "frequency": 850,
      "percentage": "56.7"
    },
    {
      "action": "cortar",
      "frequency": 720,
      "percentage": "48.0"
    },
    // ...más acciones
  ],
  "actionsList": [
    "agregar",
    "amasar",
    "batir",
    "cocinar",
    "cortar",
    // ...lista alfabética de todas las acciones
  ]
}
```

## Personalización

### Cambiar el modelo de Ollama

Edita la línea 15 del script:

```javascript
const MODEL_NAME = 'mistral'; // Cambia a 'llama3', 'mistral', etc.
```

### Ajustar el tamaño del lote

Si Ollama va muy lento o se queda sin memoria, reduce el tamaño del lote:

```javascript
const BATCH_SIZE = 5; // En lugar de 10
```

### Ajustar la temperatura

Para respuestas más consistentes (menos variación):

```javascript
temperature: 0.1, // Más determinista
```

Para respuestas más creativas (más variación):

```javascript
temperature: 0.7, // Más creativo
```

## Troubleshooting

### Error: "No se pudo conectar con Ollama"

**Solución:**
1. Verifica que Ollama esté instalado: `ollama --version`
2. Inicia Ollama si no está corriendo: `ollama serve`
3. Verifica que el modelo esté descargado: `ollama list`

### Error: "Modelo no encontrado"

**Solución:**
```bash
ollama pull llama2
```

### El script es muy lento

**Soluciones:**
1. Usa un modelo más pequeño: `mistral` en lugar de `llama3`
2. Reduce el tamaño del lote (línea 90)
3. Aumenta el tiempo de pausa entre requests (línea 130)

### Respuestas inconsistentes de Ollama

**Solución:**
- Baja la temperatura a 0.1 o 0.2 (línea 36)
- Usa un modelo más grande como `llama3`

## Uso de las acciones extraídas

Una vez que tengas el archivo `cooking-actions.json`, puedes usar las acciones para:

1. 🎨 **Crear animaciones de Neverito**
   - Cada acción representa una animación que puedes crear
   - Ejemplo: "cortar" → neveritoCortando.png
   - Ejemplo: "mezclar" → neveritoMezclando.png

2. 📊 **Priorizar animaciones por frecuencia**
   - Las acciones más frecuentes son las más importantes
   - Empieza creando animaciones para las top 10-20 acciones

3. 🎮 **Usar en la app**
   - Mostrar a Neverito realizando la acción correspondiente
   - Ejemplo: Al mostrar una receta, detectar la acción y animar a Neverito

## Ejemplo de uso futuro

```javascript
// En tu componente de React Native
import cookingActions from '../data/cooking-actions.json';

// Detectar acción en una receta
function getNeveritoAnimation(instruction) {
  const action = cookingActions.actionsList.find(a =>
    instruction.toLowerCase().includes(a)
  );

  if (action) {
    return `neverito${capitalize(action)}.png`;
  }

  return 'neveritoDefault.png';
}

// Uso
const animation = getNeveritoAnimation("Corta las cebollas en cubos");
// → "neveritoCortando.png"
```

## Tiempo estimado

- **Pequeña cantidad de recetas (< 100):** ~5-10 minutos
- **Cantidad media (100-500):** ~20-40 minutos
- **Todas las recetas (1000+):** ~1-2 horas

*El tiempo depende de tu CPU y del modelo de Ollama que uses.*

## Notas

- 🔒 **Privacidad:** Todo se ejecuta localmente, no se envía nada a internet
- 💻 **Recursos:** Ollama usa bastante CPU/RAM durante la ejecución
- ⚡ **Optimización:** El script procesa en lotes para no sobrecargar
- 🎯 **Precisión:** Los resultados pueden variar según el modelo usado

¡Diviértete creando animaciones de Neverito! 🎨✨
