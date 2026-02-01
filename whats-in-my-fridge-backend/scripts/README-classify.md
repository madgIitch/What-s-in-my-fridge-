# Script de Clasificación de Ingredientes

Este script utiliza Ollama para clasificar automáticamente todos los ingredientes en categorías españolas.

## Categorías Disponibles

- 🥛 **Lácteos**: productos lácteos (leche, queso, yogurt, etc.)
- 🥩 **Carnes**: carnes rojas y aves
- 🐟 **Pescados**: pescados y mariscos
- 🍎 **Frutas**: frutas frescas
- 🥬 **Verduras**: verduras y hortalizas
- 🌾 **Granos**: granos, legumbres, arroz, pasta
- 🥤 **Bebidas**: bebidas (jugos, refrescos, té, café)
- 🍿 **Snacks**: aperitivos y botanas
- 🧂 **Condimentos**: especias, hierbas y condimentos
- 🫒 **Aceites**: aceites y grasas
- 🌾 **Harinas**: harinas y productos de panadería sin hornear
- 🥚 **Huevos**: huevos
- 🥜 **Frutos Secos**: nueces y semillas
- 🌭 **Embutidos**: embutidos y carnes procesadas
- 🧊 **Congelados**: productos congelados
- 🥫 **Conservas**: productos enlatados o en conserva
- 🍯 **Salsas**: salsas y aderezos
- 🍰 **Postres**: postres y dulces
- 🍞 **Pan**: pan y productos de panadería
- 📦 **Otros**: otros productos

## Prerequisitos

1. **Ollama instalado y corriendo**
   ```bash
   # Verificar que Ollama esté instalado
   ollama --version

   # Iniciar Ollama (si no está corriendo)
   ollama serve
   ```

2. **Modelo llama3.1:8b descargado**
   ```bash
   # Descargar el modelo si no lo tienes
   ollama pull llama3.1:8b
   ```

3. **Node.js instalado** (versión 18 o superior)

## Uso

1. **Navega al directorio de scripts**
   ```bash
   cd whats-in-my-fridge-backend/scripts
   ```

2. **Ejecuta el script**
   ```bash
   node classify-ingredients.js
   ```

3. **El script hará lo siguiente:**
   - ✅ Verificará que Ollama esté disponible
   - 📖 Leerá el archivo `normalized-ingredients.json`
   - 💾 Creará un backup automático con timestamp
   - 🤖 Clasificará cada ingrediente usando Ollama (o heurística como fallback)
   - 📊 Mostrará estadísticas de clasificación
   - 💾 Guardará el resultado en `normalized-ingredients-classified.json`

4. **Revisa los resultados**
   ```bash
   # El archivo resultante estará en:
   # whats-in-my-fridge-backend/data/normalized-ingredients-classified.json
   ```

5. **Si todo se ve bien, reemplaza el original**
   ```bash
   cd ../data
   # Hacer un backup manual primero
   cp normalized-ingredients.json normalized-ingredients-original.json
   # Reemplazar con el clasificado
   cp normalized-ingredients-classified.json normalized-ingredients.json
   ```

## Comportamiento del Script

### Clasificación con Ollama
- El script usa temperatura baja (0.1) para resultados consistentes
- Procesa ingredientes en lotes pequeños con delays para no sobrecargar Ollama
- Incluye validación de que Ollama devuelve una categoría válida

### Fallback Heurístico
Si Ollama no está disponible o falla, el script usa clasificación basada en reglas:
- Mapea las categorías inglesas existentes a las españolas
- Usa keywords para identificar la mejor categoría
- Garantiza que todos los ingredientes reciban una clasificación

### Backup Automático
- Crea un backup con timestamp antes de procesar: `normalized-ingredients-backup-{timestamp}.json`
- Nunca sobrescribe el archivo original automáticamente
- Genera un nuevo archivo `normalized-ingredients-classified.json`

## Estructura del Archivo Resultante

Cada ingrediente tendrá un nuevo campo `categorySpanish`:

```json
{
  "salt": {
    "normalized": "salt",
    "synonyms": ["salt", "sal", "salz"],
    "category": "spice",
    "subcategory": "mineral_spice",
    "categorySpanish": "Condimentos",  // ← NUEVO CAMPO
    "frequency": 60,
    "embedding": null
  }
}
```

## Estadísticas de Ejemplo

Al finalizar, verás estadísticas como:

```
📊 Classification Statistics:
─────────────────────────────
🥬 Verduras              85
🧂 Condimentos           45
🍎 Frutas               38
🥩 Carnes               25
🥛 Lácteos              22
...
```

## Solución de Problemas

### Error: "Ollama is not running"
```bash
# Inicia Ollama
ollama serve
```

### Error: "Model not found"
```bash
# Descarga el modelo
ollama pull llama3.1:8b
```

### Clasificación incorrecta
- El script usa temperatura baja pero puede haber errores
- Revisa el archivo resultante manualmente
- Puedes editar el `emojiMap` en el código si necesitas ajustes
- Considera ajustar el prompt en la función `classifyWithOllama()`

### Performance lenta
- Normal: ~289 ingredientes tardan aproximadamente 5-10 minutos
- Ollama procesa cada ingrediente individualmente para mejor precisión
- Puedes ajustar el delay en el código si es necesario

## Modificar Categorías

Para añadir o modificar categorías:

1. **Edita el objeto `CATEGORIES` en el script**
   ```javascript
   const CATEGORIES = {
     'Nueva Categoría': ['keyword1', 'keyword2'],
     // ...
   };
   ```

2. **Actualiza el prompt de Ollama**
   - Añade la nueva categoría a la lista en `classifyWithOllama()`

3. **Actualiza los tipos de TypeScript**
   - Edita `src/types/index.ts` en la app React Native
   - Añade la categoría a `FOOD_CATEGORIES`

4. **Actualiza el emoji map**
   - Edita `src/components/food/FoodItemCard.tsx`
   - Añade el emoji correspondiente

## Logs y Debugging

El script muestra:
- Progreso en tiempo real: `[50%] 145/289 - garlic → Verduras`
- Estadísticas finales por categoría
- Rutas de archivos generados
- Errores de Ollama con fallback automático
