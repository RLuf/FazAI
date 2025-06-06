#!/usr/bin/bash

# FazAI - Script de Instalação Unificado v1.3.1
# Copyright (c) 2024 Roger Luft
# Licença: CC-BY-4.0

# Modo Debug
DEBUG_MODE=false

# Definição de cores usando abordagem OO
declare -A COR=(
    ["erro"]="\e[1;31m"
    ["sucesso"]="\e[1;32m"
    ["aviso"]="\e[1;33m"
    ["info"]="\e[1;34m"
    ["destaque"]="\e[1;35m"
    ["sistema"]="\e[1;36m"
    ["debug"]="\e[1;37m"
    ["normal"]="\e[0m"
)

# Configurações
readonly VERSAO="1.3.1"
readonly LOG_DIR="/var/log/fazai"
readonly LOG_FILE="$LOG_DIR/install.log"
readonly TENTATIVAS_MAX=3
readonly NODE_VERSIONS=("16" "18" "20")
readonly REPOSITORIES=(
    "https://deb.nodesource.com/setup_"
    "https://nodejs.org/dist/v"
)
readonly DEPENDENCY_MODULES=(
    "axios"
    "express"
    "winston"
    "ffi-napi"
    "dotenv"
    "commander"
)
readonly TUI_MODULES=(
    "blessed"
    "blessed-contrib"
    "chalk"
    "figlet"
    "inquirer"
)

# Função de log aprimorada
log() {
    local nivel=$1
    local mensagem=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    mkdir -p "$LOG_DIR"
    
    case $nivel in
        "debug")
            [ "$DEBUG_MODE" = true ] && echo -e "${COR[$nivel]}[DEBUG] $mensagem${COR[normal]}"
            ;;
        *)
            echo -e "${COR[$nivel]}[$nivel] $mensagem${COR[normal]}"
            ;;
    esac
    
    echo "[$timestamp] [$nivel] $mensagem" >> "$LOG_FILE"
}

# Função para importar configurações .env
import_env_config() {
    log "info" "Verificando configurações de ambiente..."
    
    local env_locations=(
        "/root/.env"
        "$HOME/.env"
        "./.env"
    )
    
    for env_file in "${env_locations[@]}"; do
        if [ -f "$env_file" ]; then
            log "info" "Encontrado arquivo .env em $env_file"
            source "$env_file"
            return 0
        fi
    done
    
    if [ -f ".env.example" ]; then
        log "aviso" "Arquivo .env não encontrado. Copiando .env.example..."
        cp .env.example .env
        source .env
        return 0
    fi
    
    log "erro" "Nenhum arquivo .env encontrado"
    return 1
}

# Função para verificar Node.js
verificar_nodejs() {
    log "info" "Verificando Node.js..."
    
    if ! command -v node &> /dev/null; then
        log "aviso" "Node.js não encontrado. Tentando instalar..."
        
        for version in "${NODE_VERSIONS[@]}"; do
            for repo in "${REPOSITORIES[@]}"; do
                log "debug" "Tentando repositório: ${repo}${version}"
                if curl -sL "${repo}${version}.x" | bash - && apt-get install -y nodejs; then
                    log "sucesso" "Node.js v${version} instalado com sucesso"
                    return 0
                fi
            done
        done
        
        log "erro" "Falha ao instalar Node.js"
        return 1
    fi
    
    node_version=$(node -v | cut -d'v' -f2)
    log "info" "Node.js versão $node_version encontrado"
    return 0
}

# Função para compilar módulos nativos
compilar_modulos() {
    log "info" "Compilando módulos nativos..."
    
    # Verifica GCC
    if ! command -v gcc &> /dev/null; then
        log "aviso" "GCC não encontrado. Instalando build-essential..."
        apt-get install -y build-essential
    fi
    
    # Compila módulos
    if ! npm rebuild; then
        log "aviso" "Tentando método alternativo de compilação..."
        apt-get install -y libc6-dev
        if gcc -shared -fPIC -o system_mod.so system_mod.c -I/usr/include/node; then
            log "sucesso" "Compilação alternativa bem-sucedida"
            return 0
        else
            log "erro" "Falha na compilação dos módulos nativos"
            return 1
        fi
    fi
    
    log "sucesso" "Módulos compilados com sucesso"
    return 0
}

# Função para instalar TUI
instalar_tui() {
    log "info" "Instalando interface TUI..."
    
    # Verifica e instala dependências TUI
    for modulo in "${TUI_MODULES[@]}"; do
        if ! npm list | grep -q "$modulo"; then
            log "debug" "Instalando módulo TUI: $modulo"
            if ! npm install "$modulo" --save; then
                log "erro" "Falha ao instalar módulo TUI: $modulo"
                return 1
            fi
        fi
    done
    
    # Configura TUI
    if [ -f "fazai-config.js" ]; then
        mkdir -p /opt/fazai/tools
        cp fazai-config.js /opt/fazai/tools/
        chmod +x /opt/fazai/tools/fazai-config.js
        ln -sf /opt/fazai/tools/fazai-config.js /usr/local/bin/fazai-config
        log "sucesso" "Interface TUI instalada em /usr/local/bin/fazai-config"
        return 0
    else
        log "aviso" "Arquivo fazai-config.js não encontrado"
        return 1
    fi
}

# Função para configurar serviço systemd
configurar_servico() {
    log "info" "Configurando serviço systemd..."
    
    cat > /etc/systemd/system/fazai.service << EOL
[Unit]
Description=FazAI Service
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=root
ExecStart=/usr/bin/node /opt/fazai/lib/main.js
WorkingDirectory=/opt/fazai
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

    systemctl daemon-reload
    systemctl enable fazai
    systemctl start fazai
    
    # Verificação dupla do status
    if systemctl is-active --quiet fazai; then
        log "sucesso" "Serviço FazAI iniciado"
        log "debug" "Verificando logs do serviço..."
        journalctl -u fazai --no-pager -n 10
        return 0
    else
        log "erro" "Falha ao iniciar serviço FazAI"
        return 1
    fi
}

# Função principal
main() {
    if [ "$1" = "--debug" ]; then
        DEBUG_MODE=true
        log "debug" "Modo debug ativado"
    fi

    # Verificações iniciais
    if [ "$EUID" -ne 0 ]; then
        log "erro" "Este script precisa ser executado como root (sudo)"
        exit 1
    fi

    # Cabeçalho
    echo -e "${COR[sistema]}==================================================${COR[normal]}"
    echo -e "${COR[sistema]}       FazAI v$VERSAO - Instalação Automatizada    ${COR[normal]}"
    echo -e "${COR[sistema]}==================================================${COR[normal]}"
    echo

    # Executa instalação
    import_env_config
    verificar_nodejs
    npm install --verbose
    compilar_modulos
    instalar_tui
    configurar_servico

    # Conclusão
    echo
    echo -e "${COR[sucesso]}==================================================${COR[normal]}"
    echo -e "${COR[sucesso]}       FazAI v$VERSAO instalado com sucesso!      ${COR[normal]}"
    echo -e "${COR[sucesso]}==================================================${COR[normal]}"
    echo
    echo -e "Para usar o FazAI:"
    echo -e "  ${COR[info]}fazai ajuda${COR[normal]}"
    echo -e "  ${COR[info]}fazai config${COR[normal]} (Interface TUI)"
    echo -e "  ${COR[info]}fazai logs${COR[normal]}"
    echo
}

# Inicia instalação
main "$@"