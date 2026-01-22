@echo off
REM Script para normalizar ingredientes con Claude (Windows)

echo 🚀 Iniciando normalización de ingredientes...
echo.

REM Verificar que ANTHROPIC_API_KEY esté configurado
if "%ANTHROPIC_API_KEY%"=="" (
  echo ❌ Error: ANTHROPIC_API_KEY no está configurado
  echo.
  echo Configúralo ejecutando:
  echo   set ANTHROPIC_API_KEY=tu-api-key-aqui
  echo.
  exit /b 1
)

echo ✅ API Key configurado
echo.

REM Ir al directorio de functions
cd /d "%~dp0\.."

REM Compilar TypeScript
echo 📦 Compilando TypeScript...
call npm run build

if errorlevel 1 (
  echo ❌ Error al compilar TypeScript
  exit /b 1
)

echo ✅ Compilación exitosa
echo.

REM Ejecutar script
echo 🔄 Ejecutando normalización...
echo.
node lib\src\normalizeIngredients.js

echo.
echo ✅ Script completado!
