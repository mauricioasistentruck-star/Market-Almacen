@echo off
chcp 65001 > nul
title Market Almacén - Sistema de Control
color 0B
cls
echo ======================================================================
echo             INICIANDO MARKET ALMACÉN - MODO LOCAL
echo ======================================================================
echo.
cd /d "%~dp0"
echo Abriendo servidor local...
start http://localhost:5173
call npm run dev
pause
