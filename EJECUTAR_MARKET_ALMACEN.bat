@echo off
chcp 65001 > nul
title Market Almacen - Sistema de Control y Ventas
color 0B
cls
echo ======================================================================
echo             INICIANDO MARKET ALMACEN - MODO LOCAL
echo ======================================================================
echo.
cd /d "%~dp0"
echo Abriendo servidor local de desarrollo...
start http://localhost:5173
call npm.cmd run dev
if %ERRORLEVEL% NEQ 0 (
    call npm run dev
)
pause
