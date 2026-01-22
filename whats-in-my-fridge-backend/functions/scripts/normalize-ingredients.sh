#!/bin/bash
# Script para normalizar ingredientes con Claude

echo "🚀 Iniciando normalización de ingredientes..."
echo ""

# Verificar que ANTHROPIC_API_KEY esté configurado
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ Error: ANTHROPIC_API_KEY no está configurado"
  echo ""
  echo "Configúralo ejecutando:"
  echo "  export ANTHROPIC_API_KEY='tu-api-key-aqui'"
  echo ""
  exit 1
fi

echo "✅ API Key configurado"
echo ""

# Compilar TypeScript
echo "📦 Compilando TypeScript..."
cd "$(dirname "$0")/.."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Error al compilar TypeScript"
  exit 1
fi

echo "✅ Compilación exitosa"
echo ""

# Ejecutar script
echo "🔄 Ejecutando normalización..."
echo ""
node lib/src/normalizeIngredients.js

echo ""
echo "✅ Script completado!"
