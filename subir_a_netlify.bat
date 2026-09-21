@echo off
chcp 65001 > nul
title Despliegue de Market Almacen a Netlify (100%% Gratis)
color 0B
cls
echo ======================================================================
echo          MARKET ALMACEN - SUBIR DIRECTO A NETLIFY (GRATIS)
echo ======================================================================
echo.
echo  1. Compilando la ultima version de la aplicacion web...
cd /d "%~dp0"
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    call npm run build
)
echo.
echo  2. Empaquetando entregables actualizados...
call node package_deliverables.cjs
echo.
echo ======================================================================
echo  ELIGE COMO DESEAS SUBIR A NETLIFY:
echo ======================================================================
echo  [1] Subir automaticamente por comando (Netlify CLI Directo)
echo  [2] Arrastrar y soltar en Netlify Drop (Abre navegador y archivo ZIP)
echo  [3] Solo salir
echo ======================================================================
set /p opt="Ingresa tu opcion (1, 2 o 3): "

if "%opt%"=="1" (
    echo.
    echo Iniciando despliegue directo con Netlify CLI...
    echo Si te solicita autorizar, presiona Enter para abrir el navegador e iniciar sesion.
    call npx netlify deploy --prod --dir=dist
    echo.
    echo Despliegue finalizado!
    pause
    exit /b
)

if "%opt%"=="2" (
    echo.
    echo Abriendo Netlify Drop en tu navegador y resaltando el archivo ZIP...
    start https://app.netlify.com/drop
    explorer.exe /select,"%~dp0Market-Almacen-Web-Deploy.zip"
    echo.
    echo INSTRUCCIONES:
    echo 1. En la pagina web de Netlify Drop, arrastra el archivo:
    echo    'Market-Almacen-Web-Deploy.zip' (o la carpeta 'dist')
    echo 2. Tu pagina quedara en linea de inmediato con URL publica gratuita para siempre.
    echo.
    pause
    exit /b
)

echo Operacion finalizada.
pause
