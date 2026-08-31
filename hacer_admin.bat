@echo off
title UNIGAMES - Panel de Administradores

:: Ejecutar el script interactivo en Node.js
where node >nul 2>&1 && (node hacer_admin.js & goto :EOF)

echo.
echo [ERROR] No se pudo encontrar Node.js en tu sistema.
echo Por favor instala Node.js o asegurate de que este agregado a las variables de entorno (PATH).
echo.
pause
