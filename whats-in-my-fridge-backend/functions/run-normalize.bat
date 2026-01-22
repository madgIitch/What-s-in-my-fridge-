@echo off
REM Script rápido para ejecutar normalización con Ollama (Windows)

echo 🚀 Normalizando ingredientes con Ollama...
echo.

REM Verificar que Ollama esté corriendo
echo 🔍 Verificando Ollama...
curl -s http://localhost:11434/api/version >nul 2>&1
if errorlevel 1 (
  echo ❌ Error: Ollama no está corriendo
  echo.
  echo Por favor:
  echo   1. Inicia Ollama
  echo   2. Descarga el modelo: ollama pull llama3.1:8b
  echo.
  exit /b 1
)

echo ✅ Ollama está corriendo
echo.

REM Ejecutar directamente con ts-node
cd /d "%~dp0"
npx ts-node src/normalizeIngredients.ts
