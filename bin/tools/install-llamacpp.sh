#!/usr/bin/bash
set -e

LLAMA_DIR="/opt/fazai/llama.cpp"
MODEL_DIR="$LLAMA_DIR/models"
MODEL_URL="https://huggingface.co/datasets/ggerganov/llama.cpp/resolve/main/stories15M.bin"
MODEL_FILE="stories15M.bin"

echo "=== FazAI - Instalando llama.cpp ==="

if [ ! -d "$LLAMA_DIR" ]; then
    git clone --depth 1 https://github.com/ggerganov/llama.cpp "$LLAMA_DIR"
else
    echo "Atualizando repositório llama.cpp..."
    git -C "$LLAMA_DIR" pull
fi

cd "$LLAMA_DIR"
make

mkdir -p "$MODEL_DIR"
if [ ! -f "$MODEL_DIR/$MODEL_FILE" ]; then
    echo "Baixando modelo de exemplo ($MODEL_FILE)..."
    curl -L -o "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL" || echo "Falha ao baixar modelo"
fi

echo "llama.cpp instalado em $LLAMA_DIR"
