@echo off
echo =========================================
echo       Iniciando Servidor UniGames
echo =========================================
echo.
echo Verificando e instalando dependencias...
call npm install
echo.
echo Actualizando base de datos...
where py >nul 2>&1 && (py crear_bd.py & goto :db_ok)
where python3 >nul 2>&1 && (python3 crear_bd.py & goto :db_ok)
where python >nul 2>&1 && (python crear_bd.py & goto :db_ok)
echo.
echo [ERROR] No se encontro Python instalado o no esta en el PATH.
echo         Instala Python desde https://www.python.org/downloads/
echo         y marca la opcion "Add Python to PATH".
echo.
goto :skip_db
:db_ok
echo Base de datos actualizada correctamente.
:skip_db
echo.
echo Abriendo el navegador en http://localhost:3000...
start http://localhost:3000
echo.
echo (Para detener el servidor, presiona Ctrl+C en esta ventana)
echo.
node server.js
pause
