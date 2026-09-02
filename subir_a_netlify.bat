@echo off
chcp 65001 > nul
title Despliegue de Market Almacen a Netlify
color 0A
cls
echo ======================================================================
echo          MARKET ALMACEN - DESPLIEGUE WEB A NETLIFY
echo ======================================================================
echo.
echo  1. Compilando la ultima version del proyecto web...
cd /d "%~dp0"
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    call npm run build
)
echo.
echo  2. Generando paquete listo para Netlify Drop: Market-Almacen-Web-Deploy.zip
call node package_deliverables.cjs
echo.
echo  3. Abriendo la consola de Netlify Drop en tu navegador...
start https://app.netlify.com/drop
echo.
echo  INSTRUCCIONES DE DESPLIEGUE RAPIDO:
echo  - Arrastra el archivo 'Market-Almacen-Web-Deploy.zip' o la carpeta 'dist'
echo    directamente a la ventana de Netlify Drop.
echo  - Tu aplicacion web quedara publicada de inmediato con URL publica gratuita.
echo.
echo ======================================================================
pause
