#!/bin/bash

# Script para converter modelo Gemma2-2.0-2b para formato GGUF
# Requer: llama.cpp com suporte a Gemma

set -e

FAZAI_ROOT="/opt/fazai"
MODELS_DIR="$FAZAI_ROOT/models/gemma"
LLAMA_CPP_DIR="/opt/llama.cpp"

log() {
    echo -e "\033[0;32m[$(date +'%Y-%m-%d %H:%M:%S')]\033[0m $1"
}

error() {
    echo -e "\033[0;31m[ERRO]\033[0m $1"
}

# Verificar se llama.cpp está instalado
if [[ ! -d "$LLAMA_CPP_DIR" ]]; then
    error "llama.cpp não encontrado em $LLAMA_CPP_DIR"
    error "Instale primeiro: git clone https://github.com/ggerganov/llama.cpp.git $LLAMA_CPP_DIR"
    exit 1
fi

cd "$LLAMA_CPP_DIR"

# Compilar com suporte a Gemma
log "Compilando llama.cpp com suporte a Gemma..."
make clean
make LLAMA_GEMMA=1

# Converter modelo
log "Convertendo modelo para GGUF..."
python3 convert.py "$MODELS_DIR" \
    --outfile "$MODELS_DIR/gemma2-2b-it.gguf" \
    --outtype q4_0

log "Conversão concluída: $MODELS_DIR/gemma2-2b-it.gguf"
