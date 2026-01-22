@echo off
REM Script para aplicar ingredientes normalizados a recipes.json

echo 🚀 Aplicando ingredientes normalizados a recipes.json...
echo.

cd /d "%~dp0"
npx ts-node src/applyNormalizedIngredients.ts

if errorlevel 1 (
  echo.
  echo ❌ Error al procesar recetas
  exit /b 1
)

echo.
echo ✅ Proceso completado!
echo.
echo 📝 Siguiente paso:
echo    Para reemplazar recipes.json original, ejecuta:
echo    .\replace-recipes.bat
echo.
