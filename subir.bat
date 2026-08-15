@echo off
chcp 65001 >nul
echo ==============================================
echo   UNI GAMES - SCRIPT DE SUBIDA AUTOMATICA
echo ==============================================
echo.

echo Actualizando base de datos local (crear_bd.py)...
python crear_bd.py
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Hubo un problema al ejecutar crear_bd.py.
    echo Revisa el error arriba.
    pause
    exit /b %errorlevel%
)
echo.

echo Escribe un mensaje para este cambio (ej: "Agregue palabras de programacion"):
set /p commit_msg="Mensaje: "

if "%commit_msg%"=="" (
    set commit_msg="Actualizacion automatica"
)

echo.
echo Preparando archivos...
git add .
git commit -m "%commit_msg%"
echo.
echo Subiendo a GitHub...
git push

echo.
echo ==============================================
echo   LISTO! Cambios subidos correctamente.
echo ==============================================
pause
