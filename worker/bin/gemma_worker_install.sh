#!/bin/bash
# FazAI Gemma Worker - Script de Instalação
# Autor: Roger Luft

set -e

INSTALL_DIR="/opt/fazai"
CONFIG_DIR="/etc/fazai"
LOG_DIR="/var/log/fazai"
SERVICE_NAME="fazai-gemma-worker"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função de log
log() {
    echo -e "${GREEN}[INSTALL]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    error "Este script precisa ser executado como root"
fi

log "Iniciando instalação do FazAI Gemma Worker..."

# Cria diretórios necessários
log "Criando estrutura de diretórios..."
mkdir -p $INSTALL_DIR/{bin,lib,models/gemma}
mkdir -p $CONFIG_DIR/secrets
mkdir -p $LOG_DIR
mkdir -p /var/run

# Instala dependências Python
log "Instalando dependências Python..."
pip3 install --upgrade pip

# Dependências obrigatórias
pip3 install asyncio dataclasses

# Dependências opcionais (não falha se não conseguir instalar)
log "Instalando dependências opcionais..."
pip3 install qdrant-client || warning "qdrant-client não instalado - memória vetorial desabilitada"
pip3 install openai || warning "openai não instalado - fallback OpenAI desabilitado"
pip3 install requests || warning "requests não instalado - alguns fallbacks desabilitados"

# Copia o daemon para o local de instalação
log "Instalando daemon..."
if [ -f "fazai_gemma_worker.py" ]; then
    cp fazai_gemma_worker.py $INSTALL_DIR/lib/
    chmod +x $INSTALL_DIR/lib/fazai_gemma_worker.py
else
    error "fazai_gemma_worker.py não encontrado no diretório atual"
fi

# Cria link simbólico para facilitar execução
ln -sf $INSTALL_DIR/lib/fazai_gemma_worker.py /usr/local/bin/fazai-gemma-worker

# Copia configuração se não existir
if [ ! -f "$CONFIG_DIR/gemma-worker.conf" ]; then
    log "Instalando arquivo de configuração..."
    if [ -f "gemma-worker.conf" ]; then
        cp gemma-worker.conf $CONFIG_DIR/
        chmod 600 $CONFIG_DIR/gemma-worker.conf
    else
        warning "gemma-worker.conf não encontrado - criando configuração padrão"
        cat > $CONFIG_DIR/gemma-worker.conf << 'EOF'
[socket]
type = tcp
tcp_host = 127.0.0.1
tcp_port = 5555
unix_path = /tmp/fazai-gemma.sock

[gemma]
binary = /opt/fazai/bin/gemma_oneshot
weights = /opt/fazai/models/gemma/2.0-2b-it-sfp.sbs
tokenizer = /opt/fazai/models/gemma/tokenizer.spm
model = gemma2-2b-it
temperature = 0.2
max_tokens = 1024

[qdrant]
host = 127.0.0.1
port = 6333
collection = fazai_memory
embedding_dim = 1536

[behavior]
max_retries = 3
retry_delay = 2.0
verbose = true
log_file = /var/log/fazai/gemma-worker.log
pid_file = /var/run/fazai-gemma-worker.pid
EOF
        chmod 600 $CONFIG_DIR/gemma-worker.conf
    fi
else
    log "Arquivo de configuração já existe, mantendo..."
fi

# Cria serviço systemd
log "Instalando serviço systemd..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=FazAI Gemma Worker Daemon
After=network.target
Wants=qdrant.service

[Service]
Type=forking
PIDFile=/var/run/fazai-gemma-worker.pid
ExecStart=/usr/local/bin/fazai-gemma-worker --daemon --config /etc/fazai/gemma-worker.conf
ExecStop=/bin/kill -TERM \$MAINPID
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5
User=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Recarrega systemd
systemctl daemon-reload

# Verifica se Gemma binário existe
if [ ! -f "$INSTALL_DIR/bin/gemma_oneshot" ]; then
    warning "Binário Gemma não encontrado em $INSTALL_DIR/bin/gemma_oneshot"
    warning "Compile o Gemma ou ajuste o caminho no arquivo de configuração"
fi

# Verifica se os pesos do modelo existem
if [ ! -f "$INSTALL_DIR/models/gemma/2.0-2b-it-sfp.sbs" ]; then
    warning "Pesos do modelo Gemma não encontrados"
    warning "Baixe os pesos ou ajuste o caminho no arquivo de configuração"
fi

# Ajusta permissões
chown -R root:root $INSTALL_DIR
chown -R root:root $CONFIG_DIR
chown -R root:root $LOG_DIR
chmod 755 $INSTALL_DIR
chmod 700 $CONFIG_DIR/secrets
chmod 755 $LOG_DIR

log "Instalação concluída!"
echo ""
log "Próximos passos:"
echo "  1. Configure as chaves API em $CONFIG_DIR/gemma-worker.conf"
echo "  2. Certifique-se que o binário Gemma está em $INSTALL_DIR/bin/gemma_oneshot"
echo "  3. Baixe os pesos do modelo para $INSTALL_DIR/models/gemma/"
echo "  4. Inicie o serviço com: systemctl start $SERVICE_NAME"
echo "  5. Habilite na inicialização: systemctl enable $SERVICE_NAME"
echo ""
log "Para testar o daemon:"
echo "  fazai-gemma-worker --test"