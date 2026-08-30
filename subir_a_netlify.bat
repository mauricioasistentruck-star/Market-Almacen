@echo off
chcp 65001 > nul
title Despliegue de Market Almacén a Netlify
color 0A
cls
echo ======================================================================
echo          MARKET ALMACÉN - DESPLIEGUE WEB A NETLIFY
echo ======================================================================
echo.
echo  1. Compilando la última versión del proyecto...
cd /d "%~dp0"
call npm run build
echo.
echo  2. Generando paquete listo para Netlify Drop: Market-Almacen-Web-Deploy.zip
call node package_deliverables.cjs
echo.
echo  3. Abriendo la consola de Netlify Drop en tu navegador...
start https://app.netlify.com/drop
echo.
echo  INSTRUCCIONES DE DESPLIEGUE RÁPIDO:
echo  - Arrastra la carpeta 'dist' o el archivo 'Market-Almacen-Web-Deploy.zip'
echo    directamente al círculo de Netlify Drop.
echo  - Tu página web quedará en línea de inmediato con URL propia.
echo.
echo ======================================================================
pause
