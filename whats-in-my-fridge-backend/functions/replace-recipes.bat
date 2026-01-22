@echo off
REM Script para reemplazar recipes.json con la versión normalizada

echo ⚠️  ADVERTENCIA: Este script va a reemplazar recipes.json
echo.
echo Se creará un backup en recipes.json.backup
echo.

set /p confirm="¿Continuar? (S/N): "

if /i not "%confirm%"=="S" (
  echo.
  echo ❌ Operación cancelada
  exit /b 0
)

echo.
cd /d "%~dp0"
npx ts-node src/replaceRecipes.ts

if errorlevel 1 (
  echo.
  echo ❌ Error al reemplazar recipes.json
  exit /b 1
)

echo.
pause
