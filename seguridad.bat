@echo off
chcp 65001 >nul
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
title UNIGAMES - Panel de Seguridad

:MENU
cls
echo %ESC%[95m%ESC%[1m
echo ====================================================
echo      🛡️  UNI GAMES - PANEL DE SEGURIDAD 🛡️     
echo ====================================================
echo %ESC%[0m
echo %ESC%[94mBienvenido. Este script te permite activar o desactivar%ESC%[0m
echo %ESC%[94mel bloqueo de la consola (Anti-Cheat^).%ESC%[0m
echo.
echo   %ESC%[92m1.%ESC%[0m Alternar estado de seguridad (Activar / Desactivar)
echo   %ESC%[93m0. Salir%ESC%[0m
echo.
set /p opcion="%ESC%[1mTu opción: %ESC%[0m"

if "%opcion%"=="1" goto TOGGLE
if "%opcion%"=="0" exit
goto MENU

:TOGGLE
cls
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo             MODIFICANDO SEGURIDAD...
echo ====================================================
echo %ESC%[0m
echo %ESC%[94mEjecutando script...%ESC%[0m

for /f "delims=" %%i in ('python toggle_seguridad.py') do set "resultado=%%i"

if "%resultado%"=="ACTIVADO" (
    echo.
    echo %ESC%[92m%ESC%[1m✅ SISTEMA ANTI-CHEAT ACTIVADO.%ESC%[0m
    echo %ESC%[93m^(Los jugadores ya no podrán abrir la consola F12 ni hacer trampa^).^%ESC%[0m
) else if "%resultado%"=="DESACTIVADO" (
    echo.
    echo %ESC%[91m%ESC%[1m⚠️  SISTEMA ANTI-CHEAT DESACTIVADO.%ESC%[0m
    echo %ESC%[93m^(Modo desarrollador. Ya puedes usar F12 para inspeccionar el código^).^%ESC%[0m
) else (
    echo.
    echo %ESC%[91m❌ ERROR:%ESC%[0m %resultado%
)

echo.
pause
goto MENU
