@echo off
chcp 65001 >nul
title Parser Automático de Sprites - Ninhada
color 0B

echo ==========================================
echo    VERIFICANDO NOVOS SPRITES NAS PASTAS...
echo ==========================================
echo.

node parser.js

echo.
echo ==========================================
echo    PROCESSO CONCLUIDO COM SUCESSO!
echo ==========================================
pause