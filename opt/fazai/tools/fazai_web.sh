#!/bin/bash
# FazAI Web Frontend Launcher
# Caminho: /opt/fazai/tools/fazai_web.sh

FRONTEND_FILE="/opt/fazai/tools/fazai_web_frontend.html"

# Verifica se o arquivo existe
if [ ! -f "$FRONTEND_FILE" ]; then
    echo "Erro: Arquivo do frontend não encontrado: $FRONTEND_FILE"
    exit 1
fi

echo "Iniciando interface web do FazAI..."
echo "Arquivo: $FRONTEND_FILE"

# Detecta o sistema operacional e abre o navegador apropriado
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v xdg-open > /dev/null; then
        xdg-open "$FRONTEND_FILE"
    elif command -v firefox > /dev/null; then
        firefox "$FRONTEND_FILE"
    elif command -v chromium-browser > /dev/null; then
        chromium-browser "$FRONTEND_FILE"
    elif command -v google-chrome > /dev/null; then
        google-chrome "$FRONTEND_FILE"
    else
        echo "Nenhum navegador encontrado. Abra manualmente: $FRONTEND_FILE"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "$FRONTEND_FILE"
elif [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" ]]; then
    # Windows (Cygwin/MSYS)
    start "$FRONTEND_FILE"
else
    echo "Sistema operacional não suportado. Abra manualmente: $FRONTEND_FILE"
fi

echo "Interface web iniciada!"
echo ""
echo "Se a interface não abrir automaticamente, acesse:"
echo "file://$FRONTEND_FILE"
echo ""
echo "Certifique-se de que o daemon FazAI está em execução:"
echo "sudo systemctl status fazai"