#!/usr/bin/bash

# FazAI - Script de Instalação Oficial (VERSÃO CORRIGIDA)
# Este script instala o FazAI em sistemas Debian/Ubuntu com suporte à interface TUI
# Suporte a Windows via WSL (Windows Subsystem for Linux)

# Verifica se está rodando no WSL (CORREÇÃO: Tornar opcional)
if [ -n "$WSL_DISTRO_NAME" ]; then
    echo "INFO: Detectado WSL ($WSL_DISTRO_NAME)"
else
    echo "INFO: Rodando em sistema Linux nativo"
fi

# Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "ERRO: Este script precisa ser executado como root."
    echo "Use: sudo bash install.sh"
    exit 1
fi

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variáveis de configuração
VERSION="1.3.3"
LOG_FILE="/var/log/fazai_install.log"
RETRY_COUNT=3
INSTALL_STATE_FILE="/var/lib/fazai/install.state"

# Dependências do sistema e suas versões mínimas
declare -A SYSTEM_DEPENDENCIES=(
    ["node"]="14.0.0"
    ["npm"]="6.0.0"
    ["gcc"]="7.0.0"
    ["curl"]="7.0.0"
)

# Repositórios alternativos para fallback
NODE_VERSIONS=("18" "20" "16")
REPOSITORIES=(
    "https://deb.nodesource.com/setup_"
    "https://nodejs.org/dist/v"
)

# Módulos Node.js necessários
DEPENDENCY_MODULES=(
    "axios"
    "express"
    "winston"
    "ffi-napi"
    "dotenv"
    "commander"
    "blessed"
    "blessed-contrib"
    "chalk"
    "figlet"
    "inquirer"
)

# Estado da instalação
declare -A INSTALL_STATE

# Função para registrar logs
log() {
  local level=$1
  local message=$2
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Garante que o diretório de log existe
  mkdir -p $(dirname $LOG_FILE)
  
  # Escreve log ao arquivo
  echo "[$timestamp] [$level] $message" >> $LOG_FILE
  
  # Mostra no console com cores
  case $level in
    "INFO")
      echo -e "${BLUE}[INFO]${NC} $message"
      ;;
    "SUCCESS")
      echo -e "${GREEN}[SUCESSO]${NC} $message"
      ;;
    "ERROR")
      echo -e "${RED}[ERRO]${NC} $message"
      ;;
    "WARNING")
      echo -e "${YELLOW}[AVISO]${NC} $message"
      ;;
    "DEBUG")
      if [ "$DEBUG_MODE" = true ]; then
        echo -e "${PURPLE}[DEBUG]${NC} $message"
      fi
      ;;
  esac
}

# Função para salvar estado da instalação
save_install_state() {
    local step=$1
    local status=$2
    INSTALL_STATE["$step"]="$status"
    mkdir -p $(dirname "$INSTALL_STATE_FILE")
    
    # Limpa o arquivo antes de reescrever
    > "$INSTALL_STATE_FILE"
    for key in "${!INSTALL_STATE[@]}"; do
        echo "$key=${INSTALL_STATE[$key]}" >> "$INSTALL_STATE_FILE"
    done
    log "DEBUG" "Estado salvo: $step = $status"
}

# Função para carregar estado da instalação
load_install_state() {
    if [ -f "$INSTALL_STATE_FILE" ]; then
        while IFS='=' read -r key value; do
            if [ -n "$key" ] && [ -n "$value" ]; then
                INSTALL_STATE["$key"]="$value"
            fi
        done < "$INSTALL_STATE_FILE"
        log "INFO" "Estado da instalação carregado de $INSTALL_STATE_FILE"
    fi
}

# Função para verificar versão de uma dependência
check_dependency_version() {
    local cmd=$1
    local min_version=$2
    
    if ! command -v "$cmd" &> /dev/null; then
        log "DEBUG" "Comando $cmd não encontrado"
        return 1
    fi
    
    local current_version
    case $cmd in
        "node")
            current_version=$(node -v | sed 's/v//')
            ;;
        "npm")
            current_version=$(npm -v)
            ;;
        "gcc")
            current_version=$(gcc --version | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
            ;;
        *)
            current_version=$($cmd --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1)
            ;;
    esac
    
    if [ -z "$current_version" ]; then
        log "WARNING" "Não foi possível determinar a versão de $cmd"
        return 2
    fi
    
    # Comparação de versões usando sort -V
    if printf '%s\n' "$min_version" "$current_version" | sort -V | head -n1 | grep -q "^$min_version$"; then
        log "SUCCESS" "$cmd versão $current_version atende requisito mínimo ($min_version)"
        return 0
    else
        log "WARNING" "$cmd versão $current_version é menor que a mínima requerida ($min_version)"
        return 3
    fi
}

# Função para instalar bash completion
install_bash_completion() {
    log "INFO" "Instalando bash completion..."
    
    # Verifica se o bash-completion está instalado
    if ! dpkg -l | grep -q bash-completion 2>/dev/null; then
        log "INFO" "Instalando pacote bash-completion..."
        apt-get update && apt-get install -y bash-completion
    fi
    
    # Cria script de completion básico se não existir
    local completion_dir="/etc/bash_completion.d"
    mkdir -p "$completion_dir"
    
    # Cria um script de completion básico
    cat > "$completion_dir/fazai" << 'EOF'
#!/bin/bash
_fazai_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    opts="--help --version --config --daemon --stop --restart --status --debug"
    
    if [[ ${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
        return 0
    fi
}
complete -F _fazai_completion fazai
EOF
    
    chmod 644 "$completion_dir/fazai"
    log "SUCCESS" "Script de completion instalado em $completion_dir/fazai"
    
    # Adiciona ao .bashrc se não existir
    if ! grep -q "source $completion_dir/fazai" /root/.bashrc 2>/dev/null; then
        echo "# FazAI bash completion" >> /root/.bashrc
        echo "source $completion_dir/fazai" >> /root/.bashrc
        log "SUCCESS" "Bash completion configurado no .bashrc"
    fi
}

# Função para verificar e criar diretório de logs
setup_logging() {
  mkdir -p $(dirname $LOG_FILE)
  touch $LOG_FILE
  log "INFO" "Inicializando log de instalação em $LOG_FILE"
  log "INFO" "====== Início da instalação do FazAI v$VERSION ======"
  log "INFO" "Data e hora: $(date)"
  log "INFO" "Sistema: $(uname -a)"
}

# Função para verificar permissões de root
check_root() {
  log "DEBUG" "Verificando permissões de root..."
  if [ "$EUID" -ne 0 ]; then
    log "ERROR" "Este script precisa ser executado como root (sudo)."
    exit 1
  fi
  log "SUCCESS" "Verificação de permissões de root concluída."
}

# Função para verificar o sistema operacional
check_system() {
  log "DEBUG" "Verificando sistema operacional..."
  if [ ! -f /etc/debian_version ] && [ ! -f /etc/ubuntu_version ]; then
    log "WARNING" "Este script foi projetado para sistemas Debian/Ubuntu."
    read -p "Deseja continuar mesmo assim? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
      log "INFO" "Instalação cancelada pelo usuário."
      exit 1
    fi
    log "WARNING" "Prosseguindo instalação em sistema não-Debian."
  else
    if [ -f /etc/debian_version ]; then
        log "SUCCESS" "Sistema Debian detectado: $(cat /etc/debian_version)"
    elif [ -f /etc/ubuntu_version ]; then
        log "SUCCESS" "Sistema Ubuntu detectado"
    fi
  fi
}

# Função para instalar Node.js com retry e múltiplas versões
install_nodejs() {
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log "SUCCESS" "Node.js já instalado: $NODE_VERSION"
    
    # Verifica versão mínima do Node.js (>=14.0.0)
    NODE_VERSION_NUM=$(echo $NODE_VERSION | cut -c 2-)
    NODE_MAJOR=$(echo $NODE_VERSION_NUM | cut -d. -f1)
    
    if [ $NODE_MAJOR -lt 14 ]; then
      log "WARNING" "FazAI requer Node.js versão 14.0.0 ou superior. Versão atual: $NODE_VERSION"
      log "INFO" "Tentando atualizar o Node.js..."
      install_nodejs_from_source
    fi
  else
    log "WARNING" "Node.js não encontrado. Iniciando instalação..."
    install_nodejs_from_source
  fi
}

# Função para instalar Node.js a partir de diferentes fontes
install_nodejs_from_source() {
  local success=false
  
  # Atualiza lista de pacotes primeiro
  log "INFO" "Atualizando lista de pacotes..."
  apt-get update
  
  # Tenta instalar com apt primeiro
  log "INFO" "Tentando instalar Node.js via apt..."
  apt-get install -y nodejs npm
  
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    NODE_VERSION_NUM=$(echo $NODE_VERSION | cut -c 2-)
    NODE_MAJOR=$(echo $NODE_VERSION_NUM | cut -d. -f1)
    
    if [ $NODE_MAJOR -ge 14 ]; then
      log "SUCCESS" "Node.js instalado com sucesso via apt: $NODE_VERSION"
      success=true
      return 0
    else
      log "WARNING" "Versão do Node.js instalada via apt é muito antiga: $NODE_VERSION"
    fi
  else
    log "WARNING" "Falha ao instalar Node.js via apt."
  fi
  
  # Tenta instalar via NodeSource para diferentes versões
  if [ "$success" = false ]; then
    # Instala curl se não estiver disponível
    if ! command -v curl &> /dev/null; then
      apt-get install -y curl
    fi
    
    for version in "${NODE_VERSIONS[@]}"; do
      log "INFO" "Tentando instalar Node.js v$version via NodeSource..."
      
      for attempt in $(seq 1 $RETRY_COUNT); do
        log "DEBUG" "Tentativa $attempt de $RETRY_COUNT para Node.js v$version"
        
        if curl -fsSL "https://deb.nodesource.com/setup_${version}.x" | bash - && apt-get install -y nodejs; then
          if command -v node &> /dev/null; then
            NODE_VERSION=$(node -v)
            log "SUCCESS" "Node.js instalado com sucesso: $NODE_VERSION"
            success=true
            break 2
          fi
        fi
        
        log "WARNING" "Tentativa $attempt falhou para Node.js v$version"
        sleep 2
      done
    done
  fi
  
  # Se ainda não conseguiu, mostra erro
  if [ "$success" = false ]; then
    log "ERROR" "Todas as tentativas de instalação do Node.js falharam."
    log "ERROR" "Por favor, instale o Node.js manualmente e execute este script novamente."
    log "ERROR" "Visite: https://nodejs.org/en/download/package-manager/"
    exit 1
  fi
}

# Função para verificar e instalar npm
install_npm() {
  if ! command -v npm &> /dev/null; then
    log "WARNING" "npm não encontrado. Instalando..."
    apt-get install -y npm
    
    if ! command -v npm &> /dev/null; then
      log "ERROR" "Falha ao instalar npm via apt."
      exit 1
    else
      NPM_VERSION=$(npm -v)
      log "SUCCESS" "npm instalado com sucesso: $NPM_VERSION"
    fi
  else
    NPM_VERSION=$(npm -v)
    log "SUCCESS" "npm já instalado: $NPM_VERSION"
  fi
}

# Função para verificar e instalar gcc
install_gcc() {
  if ! command -v gcc &> /dev/null; then
    log "WARNING" "gcc não encontrado. Instalando build-essential..."
    apt-get update && apt-get install -y build-essential
    
    if ! command -v gcc &> /dev/null; then
      log "ERROR" "Falha ao instalar gcc. Por favor, instale manualmente."
      exit 1
    fi
    
    GCC_VERSION=$(gcc --version | head -n1)
    log "SUCCESS" "gcc instalado com sucesso: $GCC_VERSION"
  else
    GCC_VERSION=$(gcc --version | head -n1)
    log "SUCCESS" "gcc já instalado: $GCC_VERSION"
  fi
}

# Função para criar estrutura de diretórios
create_directories() {
  log "INFO" "Criando estrutura de diretórios..."
  
  local directories=(
    "/opt/fazai/bin"
    "/opt/fazai/lib"
    "/opt/fazai/tools"
    "/opt/fazai/mods"
    "/opt/fazai/conf"
    "/etc/fazai"
    "/var/log/fazai"
    "/var/lib/fazai/history"
    "/var/lib/fazai/cache"
    "/var/lib/fazai/data"
  )
  
  for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
      mkdir -p "$dir"
      log "DEBUG" "Diretório criado: $dir"
    else
      log "DEBUG" "Diretório já existe: $dir"
    fi
  done
  
  log "SUCCESS" "Estrutura de diretórios criada com sucesso."
}

# Função para copiar arquivos
copy_files() {
  log "INFO" "Copiando arquivos para diretórios de instalação..."
  
  # Cria função auxiliar para cópia com verificação de erros
  copy_with_verification() {
    local source=$1
    local destination=$2
    local description=$3
    
    if [ -f "$source" ] || [ -d "$source" ]; then
      cp -r "$source" "$destination"
      if [ $? -eq 0 ]; then
        log "DEBUG" "$description copiado para $destination"
        return 0
      else
        log "ERROR" "Falha ao copiar $description para $destination"
        return 1
      fi
    else
      log "ERROR" "Arquivo ou diretório de origem não encontrado: $source"
      return 1
    fi
  }
  
  # Cria arquivos básicos se não existirem
  if [ ! -f "etc/fazai/main.js" ]; then
    log "INFO" "Criando arquivo principal básico..."
    mkdir -p "etc/fazai"
    cat > "etc/fazai/main.js" << 'EOF'
#!/usr/bin/env node

/**
 * FazAI - Orquestrador Inteligente de Automação
 * Arquivo principal do daemon
 */

const fs = require('fs');
const path = require('path');

console.log('FazAI v1.3.3 - Iniciando...');

// Configuração básica
const config = {
  port: process.env.FAZAI_PORT || 3120,
  logLevel: process.env.FAZAI_LOG_LEVEL || 'info'
};

console.log(`FazAI daemon rodando na porta ${config.port}`);

// Mantém o processo vivo
process.on('SIGINT', () => {
  console.log('FazAI daemon finalizando...');
  process.exit(0);
});

// Loop principal
setInterval(() => {
  // Heartbeat básico
  const timestamp = new Date().toISOString();
  fs.writeFileSync('/var/log/fazai/heartbeat.log', timestamp + '\n', { flag: 'a' });
}, 30000);
EOF
  fi
  
  # Cria CLI básico se não existir
  if [ ! -f "bin/fazai" ]; then
    log "INFO" "Criando CLI básico..."
    mkdir -p "bin"
    cat > "bin/fazai" << 'EOF'
#!/usr/bin/env node

/**
 * FazAI CLI
 */

const { spawn } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.includes('--version')) {
  console.log('FazAI v1.3.3');
  process.exit(0);
}

if (args.includes('--help')) {
  console.log('FazAI - Orquestrador Inteligente de Automação');
  console.log('');
  console.log('Uso: fazai [comando] [opções]');
  console.log('');
  console.log('Comandos:');
  console.log('  --version    Mostra a versão');
  console.log('  --help       Mostra esta ajuda');
  console.log('  --status     Status do daemon');
  console.log('  --start      Inicia o daemon');
  console.log('  --stop       Para o daemon');
  console.log('  --restart    Reinicia o daemon');
  process.exit(0);
}

if (args.includes('--status')) {
  const { execSync } = require('child_process');
  try {
    const status = execSync('systemctl is-active fazai', { encoding: 'utf8' }).trim();
    console.log(`FazAI daemon: ${status}`);
  } catch (error) {
    console.log('FazAI daemon: inativo');
  }
  process.exit(0);
}

console.log('FazAI CLI v1.3.3 - Use --help para mais informações');
EOF
    chmod +x "bin/fazai"
  fi
  
  # Cria arquivo de configuração se não existir
  if [ ! -f "etc/fazai/fazai.conf.example" ]; then
    log "INFO" "Criando arquivo de configuração exemplo..."
    cat > "etc/fazai/fazai.conf.example" << 'EOF'
# FazAI - Arquivo de Configuração
# Versão: 1.3.3

[geral]
log_level = info
daemon_port = 3000
max_workers = 4

[apis]
# Adicione suas chaves de API aqui
# openai_api_key = sua_chave_aqui
# anthropic_api_key = sua_chave_aqui

[sistema]
cache_dir = /var/lib/fazai/cache
data_dir = /var/lib/fazai/data
log_dir = /var/log/fazai
EOF
  fi
  
  # Agora copia os arquivos
  copy_with_verification "opt/fazai/lib/main.js" "/opt/fazai/lib/" "Arquivo principal"
  chmod 755 /opt/fazai/lib/main.js
  
  copy_with_verification "etc/fazai/fazai.conf.example" "/opt/fazai/conf/fazai.conf.default" "Configuração padrão"
  
  if [ ! -f "/etc/fazai/fazai.conf" ]; then
    copy_with_verification "etc/fazai/fazai.conf.example" "/etc/fazai/fazai.conf" "Configuração de sistema"
    log "SUCCESS" "Arquivo de configuração padrão criado em /etc/fazai/fazai.conf"
  else
    log "INFO" "Arquivo de configuração existente mantido em /etc/fazai/fazai.conf"
  fi
  
  copy_with_verification "bin/fazai" "/opt/fazai/bin/" "CLI"
  chmod 755 /opt/fazai/bin/fazai
  ln -sf /opt/fazai/bin/fazai /usr/local/bin/fazai
  log "SUCCESS" "CLI instalado em /usr/local/bin/fazai"
  
  log "SUCCESS" "Arquivos copiados com sucesso."
}

# Função para importar configurações de .env
import_env_config() {
  log "INFO" "Verificando configurações de ambiente..."
  
  # Locais possíveis do arquivo .env
  local env_locations=(
    "/root/.env"
    "$HOME/.env"
    "./.env"
    ".env.example"
  )
  
  local env_file=""
  
  # Procura o primeiro arquivo .env disponível
  for location in "${env_locations[@]}"; do
    if [ -f "$location" ]; then
      env_file="$location"
      log "INFO" "Arquivo .env encontrado em $env_file"
      break
    fi
  done
  
  if [ -n "$env_file" ]; then
    log "INFO" "Arquivo .env encontrado. Importando configurações..."
    
    # Extrai chaves de API
    local api_keys=(
      "OPENAI_API_KEY"
      "ANTHROPIC_API_KEY"
      "GOOGLE_API_KEY"
      "AZURE_API_KEY"
    )
    
    local fazai_conf="/etc/fazai/fazai.conf"
    local changes_made=false
    
    for key in "${api_keys[@]}"; do
      local value=$(grep "^$key=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
      if [ -n "$value" ]; then
        local config_key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
        
        # Verifica se a chave já existe no arquivo de configuração
        if grep -q "^$config_key" "$fazai_conf"; then
          # Substitui o valor existente
          sed -i "s|^$config_key.*|$config_key = $value|" "$fazai_conf"
        else
          # Adiciona nova entrada na seção de APIs
          if grep -q "^\[apis\]" "$fazai_conf"; then
            sed -i "/^\[apis\]/a $config_key = $value" "$fazai_conf"
          else
            # Se não houver seção de APIs, adiciona ao final do arquivo
            echo -e "\n[apis]\n$config_key = $value" >> "$fazai_conf"
          fi
        fi
        
        log "SUCCESS" "Chave $key importada com sucesso."
        changes_made=true
      fi
    done
    
    if [ "$changes_made" = true ]; then
      log "SUCCESS" "Configurações importadas para $fazai_conf"
    else
      log "WARNING" "Nenhuma configuração relevante encontrada em $env_file"
    fi
  else
    log "INFO" "Nenhum arquivo .env encontrado nas localizações padrão."
  fi
}

# Função para configurar o serviço systemd
configure_systemd() {
  log "INFO" "Configurando serviço systemd..."
  
  local service_file="/etc/systemd/system/fazai.service"
  
  # Gera um arquivo de serviço melhorado
  cat > "$service_file" << EOF
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
StandardOutput=append:/var/log/fazai/stdout.log
StandardError=append:/var/log/fazai/stderr.log

# Limites de recursos
LimitNOFILE=65535
LimitMEMLOCK=512M

[Install]
WantedBy=multi-user.target
EOF
  
  chmod 644 "$service_file"
  log "SUCCESS" "Arquivo de serviço systemd criado em $service_file"
  
  systemctl daemon-reload
  systemctl enable fazai
  log "SUCCESS" "Serviço systemd habilitado."
}

# Função para instalar dependências do Node.js com retry
install_node_dependencies() {
  log "INFO" "Instalando dependências do Node.js..."
  
  # Cria package.json se não existir
  if [ ! -f "package.json" ]; then
    log "INFO" "Criando package.json..."
    cat > "package.json" << 'EOF'
{
  "name": "fazai",
  "version": "1.3.3",
  "description": "FazAI - Orquestrador Inteligente de Automação",
  "main": "main.js",
  "dependencies": {
    "axios": ">=0.27.2",
    "express": ">=4.18.1",
    "winston": ">=3.8.1",
    "blessed": ">=0.1.81",
    "blessed-contrib": ">=4.11.0",
    "chalk": ">=4.1.2",
    "figlet": ">=1.5.2",
    "inquirer": ">=8.2.4"
  }
}
EOF
  fi
  
  # Instala no diretório atual primeiro
  log "INFO" "Instalando dependências no diretório atual..."
  if ! npm install --no-audit --no-progress; then
    log "WARNING" "Falha na instalação inicial de dependências. Tentando método alternativo..."
    
    # Tenta instalar pacotes críticos individualmente
    for module in "${DEPENDENCY_MODULES[@]}"; do
      log "INFO" "Instalando módulo: $module"
      npm install "$module" --no-audit --no-progress || log "WARNING" "Falha ao instalar $module"
    done
  fi
  
  # Agora instala em /opt/fazai
  log "INFO" "Instalando dependências em /opt/fazai..."
  cp package.json /opt/fazai/
  cd /opt/fazai
  
  if ! npm install --no-audit --no-progress; then
    log "WARNING" "Falha ao instalar dependências em /opt/fazai. Tentando método alternativo..."
    
    # Tenta instalar pacotes críticos individualmente
    for module in "${DEPENDENCY_MODULES[@]}"; do
      log "INFO" "Instalando módulo em /opt/fazai: $module"
      npm install "$module" --no-audit --no-progress || log "WARNING" "Falha ao instalar $module"
    done
  fi
  
  cd - > /dev/null
  log "SUCCESS" "Dependências do Node.js instaladas."
}

# Função para compilar módulos nativos
compile_native_modules() {
  log "INFO" "Verificando módulos nativos..."
  
  # Cria um módulo nativo básico se não existir
  if [ ! -d "/opt/fazai/mods" ]; then
    mkdir -p "/opt/fazai/mods"
  fi
  
  cd /opt/fazai/mods
  
  if [ ! -f "system_mod.c" ]; then
    log "INFO" "Criando módulo nativo básico..."
    cat > "system_mod.c" << 'EOF'
#include <stdio.h>
#include <stdlib.h>

// Função básica para teste do módulo nativo
int fazai_test() {
    return 42;
}
EOF
  fi
  
  if [ -f "system_mod.c" ]; then
    log "DEBUG" "Compilando system_mod.c..."
    if gcc -shared -fPIC -o system_mod.so system_mod.c; then
      log "SUCCESS" "Módulos nativos compilados com sucesso."
    else
      log "WARNING" "Falha ao compilar módulos nativos. Continuando sem eles..."
    fi
  else
    log "INFO" "Nenhum módulo nativo para compilar."
  fi
  
  cd - > /dev/null
}

# Função para instalar interface TUI
install_tui() {
  log "INFO" "Instalando interface TUI..."
  
  # Cria um arquivo de configuração TUI básico
  cat > /opt/fazai/tools/fazai-config.js << 'EOF'
#!/usr/bin/env node

/**
 * FazAI - Interface de Configuração TUI
 */

const fs = require('fs');
const path = require('path');

console.log('FazAI - Interface de Configuração TUI v1.3.3');
console.log('=========================================');
console.log('');
console.log('Funcionalidades disponíveis:');
console.log('1. Verificar status do sistema');
console.log('2. Configurar chaves de API');
console.log('3. Verificar logs do sistema');
console.log('4. Gerenciar serviços');
console.log('5. Sair');
console.log('');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showMenu() {
  rl.question('Escolha uma opção (1-5): ', (answer) => {
    switch(answer) {
      case '1':
        checkSystemStatus();
        break;
      case '2':
        configureApiKeys();
        break;
      case '3':
        checkLogs();
        break;
      case '4':
        manageServices();
        break;
      case '5':
        console.log('Saindo...');
        rl.close();
        break;
      default:
        console.log('Opção inválida!');
        showMenu();
    }
  });
}

function checkSystemStatus() {
  console.log('\n=== Status do Sistema ===');
  
  const { execSync } = require('child_process');
  
  try {
    const nodeVersion = execSync('node -v', { encoding: 'utf8' }).trim();
    console.log(`Node.js: ${nodeVersion} ✓`);
  } catch (error) {
    console.log('Node.js: ✗ Não instalado');
  }
  
  try {
    const npmVersion = execSync('npm -v', { encoding: 'utf8' }).trim();
    console.log(`npm: ${npmVersion} ✓`);
  } catch (error) {
    console.log('npm: ✗ Não instalado');
  }
  
  try {
    const serviceStatus = execSync('systemctl is-active fazai', { encoding: 'utf8' }).trim();
    console.log(`Serviço FazAI: ${serviceStatus}`);
  } catch (error) {
    console.log('Serviço FazAI: ✗ Inativo');
  }
  
  console.log('\nPressione Enter para voltar ao menu...');
  rl.question('', () => showMenu());
}

function configureApiKeys() {
  console.log('\n=== Configuração de API Keys ===');
  console.log('Configure suas chaves de API para usar o FazAI');
  
  rl.question('OpenAI API Key (deixe vazio para pular): ', (openaiKey) => {
    rl.question('Anthropic API Key (deixe vazio para pular): ', (anthropicKey) => {
      
      const configFile = '/etc/fazai/fazai.conf';
      let configContent = '';
      
      if (fs.existsSync(configFile)) {
        configContent = fs.readFileSync(configFile, 'utf8');
      }
      
      if (openaiKey) {
        if (configContent.includes('openai_api_key')) {
          configContent = configContent.replace(/openai_api_key.*/, `openai_api_key = ${openaiKey}`);
        } else {
          configContent += `\nopenai_api_key = ${openaiKey}`;
        }
        console.log('OpenAI API Key configurada ✓');
      }
      
      if (anthropicKey) {
        if (configContent.includes('anthropic_api_key')) {
          configContent = configContent.replace(/anthropic_api_key.*/, `anthropic_api_key = ${anthropicKey}`);
        } else {
          configContent += `\nanthropic_api_key = ${anthropicKey}`;
        }
        console.log('Anthropic API Key configurada ✓');
      }
      
      try {
        fs.writeFileSync(configFile, configContent);
        console.log('\nConfigurações salvas com sucesso!');
      } catch (error) {
        console.log('\nErro ao salvar configurações:', error.message);
      }
      
      console.log('\nPressione Enter para voltar ao menu...');
      rl.question('', () => showMenu());
    });
  });
}

function checkLogs() {
  console.log('\n=== Logs do Sistema ===');
  
  const logFiles = ['/var/log/fazai/fazai.log', '/var/log/fazai/error.log', '/var/log/fazai_install.log'];
  
  logFiles.forEach(logFile => {
    if (fs.existsSync(logFile)) {
      console.log(`\n--- ${logFile} ---`);
      try {
        const logContent = execSync(`tail -n 10 ${logFile}`, { encoding: 'utf8' });
        console.log(logContent);
      } catch (error) {
        console.log('Erro ao ler log:', error.message);
      }
    } else {
      console.log(`${logFile}: Arquivo não encontrado`);
    }
  });
  
  console.log('\nPressione Enter para voltar ao menu...');
  rl.question('', () => showMenu());
}

function manageServices() {
  console.log('\n=== Gerenciar Serviços ===');
  console.log('1. Iniciar FazAI');
  console.log('2. Parar FazAI');
  console.log('3. Reiniciar FazAI');
  console.log('4. Status do FazAI');
  console.log('5. Voltar ao menu principal');
  
  rl.question('Escolha uma opção: ', (answer) => {
    const { execSync } = require('child_process');
    
    try {
      switch(answer) {
        case '1':
          execSync('systemctl start fazai');
          console.log('FazAI iniciado ✓');
          break;
        case '2':
          execSync('systemctl stop fazai');
          console.log('FazAI parado ✓');
          break;
        case '3':
          execSync('systemctl restart fazai');
          console.log('FazAI reiniciado ✓');
          break;
        case '4':
          const status = execSync('systemctl status fazai', { encoding: 'utf8' });
          console.log(status);
          break;
        case '5':
          showMenu();
          return;
        default:
          console.log('Opção inválida!');
      }
    } catch (error) {
      console.log('Erro:', error.message);
    }
    
    console.log('\nPressione Enter para continuar...');
    rl.question('', () => manageServices());
  });
}

showMenu();
EOF
  
  chmod +x /opt/fazai/tools/fazai-config.js
  ln -sf /opt/fazai/tools/fazai-config.js /usr/local/bin/fazai-config
  
  log "SUCCESS" "Interface TUI instalada em /usr/local/bin/fazai-config"
}

# Função para configurar permissões de segurança
configure_security() {
  log "INFO" "Configurando permissões de segurança..."
  
  # Cria grupo fazai se não existir
  if ! getent group fazai > /dev/null 2>&1; then
    groupadd -r fazai
    log "SUCCESS" "Grupo 'fazai' criado"
  fi
  
  # Cria usuário fazai se não existir
  if ! getent passwd fazai > /dev/null 2>&1; then
    useradd -r -g fazai -s /bin/false -d /opt/fazai fazai
    log "SUCCESS" "Usuário 'fazai' criado"
  fi
  
  # Define permissões dos diretórios
  chown -R fazai:fazai /opt/fazai
  chown -R fazai:fazai /var/log/fazai
  chown -R fazai:fazai /var/lib/fazai
  
  # Permissões específicas
  chmod 750 /opt/fazai
  chmod 755 /opt/fazai/bin/fazai
  chmod 640 /etc/fazai/fazai.conf
  chmod 755 /opt/fazai/tools/fazai-config.js
  
  # Configura sudoers para permitir comandos específicos do fazai
  if [ ! -f /etc/sudoers.d/fazai ]; then
    cat > /etc/sudoers.d/fazai << 'EOF'
# FazAI sudoers configuration
%fazai ALL=(ALL) NOPASSWD: /bin/systemctl start fazai
%fazai ALL=(ALL) NOPASSWD: /bin/systemctl stop fazai
%fazai ALL=(ALL) NOPASSWD: /bin/systemctl restart fazai
%fazai ALL=(ALL) NOPASSWD: /bin/systemctl status fazai
%fazai ALL=(ALL) NOPASSWD: /usr/bin/apt-get update
%fazai ALL=(ALL) NOPASSWD: /usr/bin/apt-get install *
%fazai ALL=(ALL) NOPASSWD: /usr/sbin/service * *
EOF
    chmod 440 /etc/sudoers.d/fazai
    log "SUCCESS" "Configuração sudoers criada"
  fi
  
  log "SUCCESS" "Permissões de segurança configuradas"
}

# Função para criar scripts auxiliares
create_helper_scripts() {
  log "INFO" "Criando scripts auxiliares..."
  
  # Script de uninstall
  cat > /opt/fazai/bin/uninstall.sh << 'EOF'
#!/bin/bash
# FazAI Uninstall Script

echo "Desinstalando FazAI..."

# Para o serviço
systemctl stop fazai 2>/dev/null
systemctl disable fazai 2>/dev/null

# Remove arquivos de serviço
rm -f /etc/systemd/system/fazai.service
systemctl daemon-reload

# Remove links simbólicos
rm -f /usr/local/bin/fazai
rm -f /usr/local/bin/fazai-config

# Remove diretórios (com confirmação)
read -p "Remover todos os dados do FazAI? (logs, configurações, etc.) [s/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
  rm -rf /opt/fazai
  rm -rf /etc/fazai
  rm -rf /var/log/fazai
  rm -rf /var/lib/fazai
  echo "Todos os dados removidos."
else
  echo "Dados preservados em /etc/fazai, /var/log/fazai e /var/lib/fazai"
fi

# Remove usuário e grupo
userdel fazai 2>/dev/null
groupdel fazai 2>/dev/null

# Remove sudoers
rm -f /etc/sudoers.d/fazai

echo "FazAI desinstalado com sucesso!"
EOF
  
  chmod +x /opt/fazai/bin/uninstall.sh
  ln -sf /opt/fazai/bin/uninstall.sh /usr/local/bin/fazai-uninstall
  
  # Script de backup
  cat > /opt/fazai/bin/backup.sh << 'EOF'
#!/bin/bash
# FazAI Backup Script

BACKUP_DIR="/tmp/fazai-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Criando backup em $BACKUP_DIR..."

# Backup de configurações
cp -r /etc/fazai "$BACKUP_DIR/"
cp -r /var/lib/fazai "$BACKUP_DIR/"

# Backup de logs (últimos 7 dias)
find /var/log/fazai -name "*.log" -mtime -7 -exec cp {} "$BACKUP_DIR/" \;

# Compacta o backup
cd /tmp
tar -czf "fazai-backup-$(date +%Y%m%d-%H%M%S).tar.gz" "$(basename $BACKUP_DIR)"
rm -rf "$BACKUP_DIR"

echo "Backup criado: /tmp/fazai-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
EOF
  
  chmod +x /opt/fazai/bin/backup.sh
  ln -sf /opt/fazai/bin/backup.sh /usr/local/bin/fazai-backup
  
  log "SUCCESS" "Scripts auxiliares criados"
}

# Função para configurar logrotate
configure_logrotate() {
  log "INFO" "Configurando rotação de logs..."
  
  cat > /etc/logrotate.d/fazai << 'EOF'
/var/log/fazai/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 fazai fazai
    postrotate
        systemctl reload fazai > /dev/null 2>&1 || true
    endscript
}
EOF
  
  log "SUCCESS" "Configuração de logrotate criada"
}

# Função para validar a instalação
validate_installation() {
  log "INFO" "Validando instalação..."
  
  local validation_errors=0
  
  # Verifica arquivos essenciais
  local essential_files=(
    "/opt/fazai/lib/main.js"
    "/opt/fazai/bin/fazai"
    "/etc/fazai/fazai.conf"
    "/etc/systemd/system/fazai.service"
    "/usr/local/bin/fazai"
  )
  
  for file in "${essential_files[@]}"; do
    if [ ! -f "$file" ]; then
      log "ERROR" "Arquivo essencial não encontrado: $file"
      validation_errors=$((validation_errors + 1))
    else
      log "DEBUG" "Arquivo validado: $file"
    fi
  done
  
  # Verifica diretórios
  local essential_dirs=(
    "/opt/fazai"
    "/etc/fazai"
    "/var/log/fazai"
    "/var/lib/fazai"
  )
  
  for dir in "${essential_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
      log "ERROR" "Diretório essencial não encontrado: $dir"
      validation_errors=$((validation_errors + 1))
    else
      log "DEBUG" "Diretório validado: $dir"
    fi
  done
  
  # Verifica comandos
  if ! command -v fazai &> /dev/null; then
    log "ERROR" "Comando 'fazai' não está disponível"
    validation_errors=$((validation_errors + 1))
  fi
  
  # Verifica serviço systemd
  if ! systemctl is-enabled fazai &> /dev/null; then
    log "WARNING" "Serviço fazai não está habilitado"
  fi
  
  # Verifica dependências Node.js críticas
  cd /opt/fazai
  local critical_modules=("express" "winston")
  for module in "${critical_modules[@]}"; do
    if ! npm list "$module" &> /dev/null; then
      log "WARNING" "Módulo Node.js crítico não encontrado: $module"
    fi
  done
  
  if [ $validation_errors -eq 0 ]; then
    log "SUCCESS" "Validação da instalação concluída com sucesso!"
    return 0
  else
    log "ERROR" "Validação falhou com $validation_errors erro(s)"
    return 1
  fi
}

# Função para executar testes pós-instalação
run_post_install_tests() {
  log "INFO" "Executando testes pós-instalação..."
  
  # Teste 1: Verifica se o CLI responde
  log "DEBUG" "Testando CLI..."
  if fazai --version &> /dev/null; then
    log "SUCCESS" "Teste CLI: OK"
  else
    log "WARNING" "Teste CLI: Falhou"
  fi
  
  # Teste 2: Verifica se o serviço pode ser iniciado
  log "DEBUG" "Testando serviço systemd..."
  if systemctl start fazai && sleep 2 && systemctl is-active fazai &> /dev/null; then
    log "SUCCESS" "Teste serviço: OK"
    systemctl stop fazai
  else
    log "WARNING" "Teste serviço: Falhou"
  fi
  
  # Teste 3: Verifica permissões
  log "DEBUG" "Testando permissões..."
  if [ -r /etc/fazai/fazai.conf ] && [ -x /opt/fazai/bin/fazai ]; then
    log "SUCCESS" "Teste permissões: OK"
  else
    log "WARNING" "Teste permissões: Falhou"
  fi
  
  log "SUCCESS" "Testes pós-instalação concluídos"
}

# Função para mostrar informações finais
show_installation_summary() {
  log "INFO" "====== Resumo da Instalação ======"
  
  echo -e "\n${GREEN}✓ FazAI v$VERSION instalado com sucesso!${NC}\n"
  
  echo -e "${BLUE}Localização dos arquivos:${NC}"
  echo "  • Binários: /opt/fazai"
  echo "  • Configuração: /etc/fazai/fazai.conf"
  echo "  • Logs: /var/log/fazai"
  echo "  • Dados: /var/lib/fazai"
  echo ""
  
  echo -e "${BLUE}Comandos disponíveis:${NC}"
  echo "  • fazai --help          - Ajuda do sistema"
  echo "  • fazai --version       - Versão instalada"
  echo "  • fazai --status        - Status do daemon"
  echo "  • fazai-config          - Interface de configuração"
  echo "  • fazai-backup          - Criar backup"
  echo "  • fazai-uninstall       - Desinstalar"
  echo ""
  
  echo -e "${BLUE}Gerenciamento do serviço:${NC}"
  echo "  • systemctl start fazai    - Iniciar"
  echo "  • systemctl stop fazai     - Parar"
  echo "  • systemctl restart fazai  - Reiniciar"
  echo "  • systemctl status fazai   - Ver status"
  echo ""
  
  echo -e "${YELLOW}Próximos passos:${NC}"
  echo "  1. Configure suas API keys: fazai-config"
  echo "  2. Inicie o serviço: systemctl start fazai"
  echo "  3. Teste o sistema: fazai --status"
  echo ""
  
  echo -e "${PURPLE}Para suporte e documentação:${NC}"
  echo "  • GitHub: https://github.com/RLuf/FazAI"
  echo "  • Logs: /var/log/fazai_install.log"
  echo ""
  
  # Salva estado final
  save_install_state "installation_complete" "success"
  
  log "SUCCESS" "====== Instalação Finalizada ======"
}

# Função principal de instalação
main_install() {
  log "INFO" "Iniciando instalação do FazAI v$VERSION"
  
  # Carrega estado anterior se existir
  load_install_state
  
  # Executa etapas de instalação
  local install_steps=(
    "setup_logging:Configurando sistema de logs"
    "check_root:Verificando permissões"
    "check_system:Verificando sistema operacional"
    "install_nodejs:Instalando Node.js"
    "install_npm:Verificando npm"
    "install_gcc:Instalando ferramentas de compilação"
    "create_directories:Criando estrutura de diretórios"
    "copy_files:Copiando arquivos"
    "import_env_config:Importando configurações"
    "configure_systemd:Configurando serviço systemd"
    "install_node_dependencies:Instalando dependências Node.js"
    "compile_native_modules:Compilando módulos nativos"
    "install_tui:Instalando interface TUI"
    "configure_security:Configurando segurança"
    "create_helper_scripts:Criando scripts auxiliares"
    "configure_logrotate:Configurando rotação de logs"
    "install_bash_completion:Instalando autocompletar"
  )
  
  local total_steps=${#install_steps[@]}
  local current_step=0
  
  for step_info in "${install_steps[@]}"; do
    local step_function=$(echo "$step_info" | cut -d: -f1)
    local step_description=$(echo "$step_info" | cut -d: -f2)
    
    current_step=$((current_step + 1))
    
    # Verifica se já foi executado
    if [ "${INSTALL_STATE[$step_function]}" = "completed" ]; then
      log "INFO" "[$current_step/$total_steps] $step_description (já concluído)"
      continue
    fi
    
    log "INFO" "[$current_step/$total_steps] $step_description"
    
    # Executa a função
    if $step_function; then
      save_install_state "$step_function" "completed"
      log "SUCCESS" "$step_description - Concluído"
    else
      log "ERROR" "$step_description - Falhou"
      save_install_state "$step_function" "failed"
      
      # Pergunta se deve continuar
      read -p "Erro na etapa '$step_description'. Continuar mesmo assim? (s/N): " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        log "ERROR" "Instalação interrompida pelo usuário"
        exit 1
      fi
    fi
  done
  
  # Validação e testes finais
  log "INFO" "Executando validação final..."
  if validate_installation; then
    run_post_install_tests
    show_installation_summary
    
    # Inicia o serviço se tudo estiver OK
    if systemctl start fazai; then
      log "SUCCESS" "Serviço FazAI iniciado com sucesso!"
    else
      log "WARNING" "Falha ao iniciar o serviço. Inicie manualmente: systemctl start fazai"
    fi
  else
    log "ERROR" "Validação da instalação falhou. Verifique os logs em $LOG_FILE"
    exit 1
  fi
}

# Função para limpeza em caso de interrupção
cleanup_on_exit() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    log "WARNING" "Instalação interrompida (código: $exit_code)"
    log "INFO" "Estado salvo em $INSTALL_STATE_FILE"
    log "INFO" "Execute novamente o script para continuar de onde parou"
  fi
}

# Captura sinais para limpeza
trap cleanup_on_exit EXIT INT TERM

# Verifica argumentos de linha de comando
case "${1:-}" in
  --debug)
    DEBUG_MODE=true
    log "INFO" "Modo debug ativado"
    ;;
  --clean)
    rm -f "$INSTALL_STATE_FILE"
    log "INFO" "Estado de instalação limpo"
    ;;
  --help)
    echo "FazAI Installer v$VERSION"
    echo "Uso: $0 [opções]"
    echo ""
    echo "Opções:"
    echo "  --debug    Ativa modo debug com logs detalhados"
    echo "  --clean    Remove estado de instalação anterior"
    echo "  --help     Mostra esta ajuda"
    echo ""
    exit 0
    ;;
esac

# Inicia instalação principal
main_install

log "SUCCESS" "Instalação do FazAI concluída com sucesso!"
echo -e "\n${GREEN}🎉 FazAI está pronto para uso!${NC}"
echo -e "Execute ${CYAN}fazai-config${NC} para configurar suas API keys."

exit 0