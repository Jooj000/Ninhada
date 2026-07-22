@echo off
chcp 65001 >nul
title Atualizar Ninhada - Git Auto Push
color 0A

echo ==========================================
echo    ATUALIZANDO O JOGO NINHADA NO GITHUB
echo ==========================================
echo.

:: Mostra o status atual
git status
echo.

:: Pede a mensagem do commit
set /p msg="Digite a mensagem do commit (ou aperte ENTER para usar padrao): "
if "%msg%"=="" set msg="update: atualizacao automatica do jogo"

echo.
echo [1/3] Adicionando arquivos...
git add .

echo [2/3] Criando commit...
git commit -m "%msg%"

echo [3/3] Enviando para o GitHub...
git push origin main

echo.
echo ==========================================
echo    ATUALIZACAO CONCLUIDA COM SUCESSO!
echo ==========================================
pause