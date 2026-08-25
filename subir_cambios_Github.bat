@echo off
chcp 65001 >nul
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
title UNIGAMES - Git Manager

:MENU
cls
echo %ESC%[95m%ESC%[1m
echo ====================================================
echo      🐙 UNI GAMES - GITHUB MANAGER SCRIPT 🐙     
echo ====================================================
echo %ESC%[0m
echo %ESC%[94m--- Opciones Disponibles ---%ESC%[0m
echo.
echo   %ESC%[92m1.%ESC%[0m Subir cambios al repositorio (Git Add, Commit ^& Push)
echo   %ESC%[92m2.%ESC%[0m Reconstruir DB y luego subir (crear_bd.py + Push)
echo   %ESC%[92m3.%ESC%[0m Descargar últimos cambios (Git Pull)
echo   %ESC%[92m4.%ESC%[0m Ver estado de los archivos (Git Status)
echo   %ESC%[93m0. Salir%ESC%[0m
echo.
set /p opcion="%ESC%[1mTu opción: %ESC%[0m"

if "%opcion%"=="1" goto SUBIR
if "%opcion%"=="2" goto BD_Y_SUBIR
if "%opcion%"=="3" goto DESCARGAR
if "%opcion%"=="4" goto ESTADO
if "%opcion%"=="0" exit
goto MENU

:BD_Y_SUBIR
cls
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo        RECONSTRUYENDO BD ANTES DE SUBIR
echo ====================================================
echo %ESC%[0m
echo %ESC%[94mActualizando base de datos local...%ESC%[0m
where py >nul 2>&1 && (py crear_bd.py & goto :db_done)
where python >nul 2>&1 && (python crear_bd.py & goto :db_done)
echo %ESC%[91m[ERROR] No se pudo ejecutar crear_bd.py%ESC%[0m
pause
goto SUBIR

:db_done
if %errorlevel% neq 0 (
    echo.
    echo %ESC%[91m❌ ERROR: Hubo un problema al ejecutar crear_bd.py.%ESC%[0m
    pause
    goto MENU
)
echo %ESC%[92m✅ DB actualizada. Procediendo a subir...%ESC%[0m
goto SUBIR_DIRECTO

:SUBIR
cls
:SUBIR_DIRECTO
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo                SUBIENDO A GITHUB
echo ====================================================
echo %ESC%[0m
echo %ESC%[93mEscribe un mensaje para este cambio (ej: "Nuevos niveles agregados"):%ESC%[0m
set /p commit_msg="%ESC%[1m%ESC%[94mMensaje: %ESC%[0m"

if "%commit_msg%"=="" (
    set commit_msg="Actualizacion automatica (sin mensaje)"
)

echo.
echo %ESC%[94m[1/3] Preparando archivos (git add .)...%ESC%[0m
git add .
echo %ESC%[94m[2/3] Creando commit (git commit)...%ESC%[0m
git commit -m "%commit_msg%"
echo.
echo %ESC%[94m[3/3] Subiendo a los servidores de GitHub (git push)...%ESC%[0m
git push

echo.
echo %ESC%[92m%ESC%[1m🎉 ¡LISTO! Todos los cambios fueron subidos correctamente.%ESC%[0m
echo.
pause
goto MENU

:DESCARGAR
cls
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo           DESCARGANDO CAMBIOS (GIT PULL)
echo ====================================================
echo %ESC%[0m
echo %ESC%[94mSincronizando con el repositorio...%ESC%[0m
git pull
echo.
echo %ESC%[92m%ESC%[1m✅ Sincronización completada.%ESC%[0m
echo.
pause
goto MENU

:ESTADO
cls
echo %ESC%[96m%ESC%[1m
echo ====================================================
echo            ESTADO ACTUAL (GIT STATUS)
echo ====================================================
echo %ESC%[0m
git status
echo.
pause
goto MENU
