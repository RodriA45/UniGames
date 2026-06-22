@echo off
echo =========================================
echo       Iniciando Servidor UniGames
echo =========================================
echo.
echo Verificando e instalando dependencias (esto puede tardar unos segundos)...
call npm install
echo.
echo Abriendo el navegador en http://localhost:3000...
start http://localhost:3000
echo.
echo (Para detener el servidor, presiona Ctrl+C en esta ventana)
echo.
node server.js
pause
