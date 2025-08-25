#!/bin/bash
set -e

# Função para log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Verificar diretórios necessários
for dir in "/opt/fazai" "/etc/fazai" "/var/log/fazai" "/run/fazai"; do
    if [ ! -d "$dir" ]; then
        log "Criando diretório $dir"
        mkdir -p "$dir"
    fi
done

# Verificar arquivo de configuração
if [ ! -f "/etc/fazai/fazai.conf" ]; then
    log "Configuração não encontrada. Copiando configuração padrão..."
    cp /etc/fazai/fazai.conf.example /etc/fazai/fazai.conf
fi

# Verificar variáveis de ambiente
if [ -z "$FAZAI_PORT" ]; then
    log "FAZAI_PORT não definida. Usando porta padrão 3120"
    export FAZAI_PORT=3120
fi

# Verificar permissões
log "Verificando permissões..."
chown -R root:root /opt/fazai || true
chmod -R 755 /opt/fazai/bin || true
chmod 755 /run/fazai || true

# Variáveis do worker
export FAZAI_GEMMA_SOCKET=${FAZAI_GEMMA_SOCKET:-/run/fazai/gemma.sock}
export FAZAI_GEMMA_SOCK=$FAZAI_GEMMA_SOCKET
export FAZAI_GEMMA_MODEL=${FAZAI_GEMMA_MODEL:-/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs}

# Iniciar worker em background se existir
if [ -x "/opt/fazai/bin/fazai-gemma-worker" ]; then
  if [ ! -S "$FAZAI_GEMMA_SOCKET" ]; then
    log "Iniciando Gemma Worker (socket: $FAZAI_GEMMA_SOCKET)"
  else
    log "Socket existente encontrado: $FAZAI_GEMMA_SOCKET"
  fi
  /opt/fazai/bin/fazai-gemma-worker &
fi

# Informar versão do Node.js
log "Usando Node.js $(node -v)"

# Iniciar o FazAI
log "Iniciando FazAI na porta $FAZAI_PORT"
exec "$@"
