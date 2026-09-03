@echo off
chcp 65001 >nul
:: Permite interpretar secuencias ANSI de colores (ESC)
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
title UNIGAMES - Inicio y Servidor

:MENU
cls
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo     🚀 UNIGAMES - PANEL DE ARRANQUE DEL SERVIDOR 🚀   
echo ====================================================
echo %ESC%[0m
echo %ESC%[94m--- Opciones de Arranque ---%ESC%[0m
echo.
echo   %ESC%[92m1.%ESC%[0m Iniciar Servidor Completo (Instala librerías, DB y arranca)
echo   %ESC%[92m2.%ESC%[0m Inicio Rápido (Solo arranca node.js)
echo   %ESC%[92m3.%ESC%[0m Reconstruir Base de Datos PostgreSQL (init_db.js)
echo   %ESC%[93m0. Salir%ESC%[0m
echo.
set /p opcion="%ESC%[1mTu opción: %ESC%[0m"

if "%opcion%"=="1" goto COMPLETO
if "%opcion%"=="2" goto RAPIDO
if "%opcion%"=="3" goto SOLO_BD
if "%opcion%"=="0" exit
goto MENU

:COMPLETO
cls
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo             INICIANDO SERVIDOR COMPLETO
echo ====================================================
echo %ESC%[0m
echo %ESC%[94m[1/3] Verificando e instalando dependencias (npm install)...%ESC%[0m
call npm install >nul 2>&1
echo %ESC%[92m^> Dependencias listas.%ESC%[0m
echo.
echo %ESC%[94m[2/3] Actualizando base de datos (init_db.js)...%ESC%[0m
where node >nul 2>&1 && (node database/init_db.js && node database/seed_games.js & goto :db_ok)
echo %ESC%[91m[ERROR] No se encontró Node.js. Asegúrate de tenerlo instalado y en el PATH.%ESC%[0m
pause
goto :skip_db
:db_ok
echo %ESC%[92m^> Base de datos actualizada correctamente.%ESC%[0m
:skip_db
echo.
echo %ESC%[94m[3/3] Abriendo el navegador web...%ESC%[0m
start http://localhost:3000
echo.
echo %ESC%[92m%ESC%[1m^> El servidor de UniGames está en línea.^< %ESC%[0m
echo %ESC%[93m(Para detener el servidor y volver al menú, presiona Ctrl+C y luego 'N')%ESC%[0m
echo.
node server.js
pause
goto MENU

:RAPIDO
cls
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo              ARRANCANDO SERVIDOR (RÁPIDO)
echo ====================================================
echo %ESC%[0m
echo %ESC%[94mAbriendo navegador...%ESC%[0m
start http://localhost:3000
echo %ESC%[92m%ESC%[1m^> El servidor está corriendo en http://localhost:3000 %ESC%[0m
echo %ESC%[93m(Para detener, presiona Ctrl+C y luego 'N')%ESC%[0m
echo.
node server.js
pause
goto MENU

:SOLO_BD
cls
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo            RECONSTRUYENDO BASE DE DATOS
echo ====================================================
echo %ESC%[0m
echo %ESC%[94mEjecutando scripts (init_db.js y seed_games.js)...%ESC%[0m
where node >nul 2>&1 && (node database/init_db.js && node database/seed_games.js & goto :db_ok_solo)
echo %ESC%[91m[ERROR] No se encontró Node.js.%ESC%[0m
pause
goto MENU
:db_ok_solo
echo.
echo %ESC%[92m%ESC%[1m✅ Base de datos reconstruida con éxito.%ESC%[0m
echo.
pause
goto MENU
