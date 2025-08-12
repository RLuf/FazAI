#!/bin/bash

# Script para testar o modelo Gemma2-2.0-2b

set -e

FAZAI_ROOT="/opt/fazai"
MODELS_DIR="$FAZAI_ROOT/models/gemma"
GEMMA_BIN="$FAZAI_ROOT/bin/gemma_oneshot"

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')]\033[0m $1"
}

error() {
    echo -e "\033[0;31m[ERRO]\033[0m $1"
}

# Verificar se o modelo existe
if [[ ! -f "$MODELS_DIR/gemma2-2b-it.gguf" ]]; then
    error "Modelo GGUF não encontrado: $MODELS_DIR/gemma2-2b-it.gguf"
    error "Execute primeiro: $FAZAI_ROOT/bin/convert_gemma2_to_gguf.sh"
    exit 1
fi

# Verificar se o binário existe
if [[ ! -f "$GEMMA_BIN" ]]; then
    error "Binário gemma_oneshot não encontrado: $GEMMA_BIN"
    exit 1
fi

log "Testando modelo Gemma2-2.0-2b..."

# Prompt de teste
TEST_PROMPT="Gere um script bash para monitorar o uso de CPU e memória de um servidor Linux"

log "Prompt de teste: $TEST_PROMPT"
echo "---"

# Executar teste
"$GEMMA_BIN" \
    --model "$MODELS_DIR/gemma2-2b-it.gguf" \
    --prompt "$TEST_PROMPT" \
    --n-predict 256 \
    --temperature 0.2 \
    --top-p 0.9

echo "---"
log "Teste concluído"
