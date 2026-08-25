@echo off
title UNIGAMES - Panel de Administradores

:: Ejecutar el script interactivo en Python
where py >nul 2>&1 && (py hacer_admin.py & goto :EOF)
where python >nul 2>&1 && (python hacer_admin.py & goto :EOF)
where python3 >nul 2>&1 && (python3 hacer_admin.py & goto :EOF)

echo.
echo [ERROR] No se pudo encontrar Python en tu sistema.
echo Por favor instala Python o asegurate de que este agregado a las variables de entorno (PATH).
echo.
pause
