@echo off
REM Script para subir vocabulario normalizado a Firebase Storage

echo 📤 Subiendo normalized-ingredients.json a Firebase Storage...
echo.

cd /d "%~dp0"

REM Subir a Firebase Storage
firebase storage:upload data/normalized-ingredients.json /normalized-ingredients.json

if errorlevel 1 (
  echo.
  echo ❌ Error al subir archivo
  exit /b 1
)

echo.
echo ✅ Archivo subido exitosamente!
echo.
echo 📍 Ubicación: gs://[tu-proyecto].appspot.com/normalized-ingredients.json
echo.
pause
