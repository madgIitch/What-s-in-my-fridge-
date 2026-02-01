# Quick Start: Extracción de Acciones de Cocina 🚀

## Instalación y Configuración

### ✅ Ya tienes todo listo!

Ollama ya está instalado con estos modelos:
- ✅ llama3.1:8b (el que usaremos)
- ✅ qwen2.5-coder:7b-instruct
- ✅ deepseek-coder:6.7b-instruct
- ✅ llama3.2:3b

El script usa `llama3.1:8b` por defecto.

## Uso Rápido

### Extraer todas las acciones de cocina

```bash
cd whats-in-my-fridge-backend
npm run extract-actions
```

⏱️ **Tiempo estimado:** 1-2 horas para todas las recetas

### ✨ Características:

- **🇪🇸 Acciones en español**: Todas las acciones se extraen en español (infinitivo)
- **💾 Guardado automático**: Guarda progreso después de cada receta
- **🔄 Reanudación automática**: Se puede interrumpir (Ctrl+C) y retoma automáticamente
- **📊 Progreso en tiempo real**: Muestra estadísticas mientras procesa

### Ver ejemplo de uso

```bash
npm run example-usage
```

## Resultado

Generará el archivo `data/cooking-actions.json` con:

```json
{
  "totalRecipesProcessed": 1500,
  "totalUniqueActions": 120,
  "actions": [
    { "action": "mezclar", "frequency": 850, "percentage": "56.7" },
    { "action": "cortar", "frequency": 720, "percentage": "48.0" },
    { "action": "cocinar", "frequency": 680, "percentage": "45.3" }
    // ... más acciones
  ],
  "actionsList": [
    "agregar", "amasar", "batir", "cocinar", "cortar", ...
  ]
}
```

## Próximos Pasos

1. 🎨 **Crear animaciones de Neverito** basadas en las acciones más frecuentes
2. 📁 **Nombrar archivos:** `neveritoMezclando.png`, `neveritoCortando.png`, etc.
3. 🔌 **Integrar en la app** para mostrar a Neverito haciendo las acciones

## Ejemplo de Nombres de Archivos

Basado en las acciones más comunes:

```
assets/neveritoMezclando.png
assets/neveritoCortando.png
assets/neveritoCocinando.png
assets/neveritoHirviendo.png
assets/neveritoHorneando.png
assets/neveritoFreyendo.png
assets/neveritoBatiendo.png
assets/neveritoAgregando.png
assets/neveritoSalteando.png
assets/neveritoDecorando.png
```

## Troubleshooting

**Error: "No se pudo conectar con Ollama"**
```bash
# Verifica que Ollama esté corriendo
ollama serve
```

**Error: "Modelo no encontrado"**
```bash
ollama pull llama2
```

**Script muy lento?**
- Usa un modelo más pequeño: `ollama pull mistral`
- Reduce el BATCH_SIZE en el script

## Documentación Completa

Ver `scripts/README-cooking-actions.md` para más detalles.

---

¿Preguntas? Revisa el README completo o el código de ejemplo! 🎨✨
