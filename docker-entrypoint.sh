#!/bin/bash
set -e

# Função para log
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Verificar diretórios necessários
for dir in "/opt/fazai" "/etc/fazai" "/var/log/fazai"; do
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
chown -R root:root /opt/fazai
chmod -R 755 /opt/fazai/bin

# Informar versão do Node.js
log "Usando Node.js $(node -v)"

# Iniciar o FazAI
log "Iniciando FazAI na porta $FAZAI_PORT"
exec "$@"
