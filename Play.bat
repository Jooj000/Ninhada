@echo off
title Servidor - Bebe Virtual PWA
cd /d "C:\Users\joart\Downloads\Jooj\Pasta de jogos\Pastas\bebe-virtual"

echo [1/2] Abrindo o navegador em http://localhost:8080...
start http://localhost:8080

echo [2/2] Iniciando o servidor Python... Pressione Ctrl+C para fechar quando terminar.
python -m http.server 8080

pause