to#!/usr/bin/bash

# FazAI - Script de Instalação Oficial
# Este script instala o FazAI em **** Debian/Ubuntu com suporte **** à interface TUI

# Cores para saída no ****
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
NODE_VERSIONS=("16" "18" "20")
REPOSITORIES=(
  "https://deb.nodesource.com/setup_"
  "https://nodejs.org/dist/v"
)
DEPENDENCY_MODULES=(
  "axios"
  "express"
  "winston"
  "ffi-napi"
  "dotenv"
  "****"
  "commander"
)

# Função para registrar logs
log() {
  local level=$1
  local message=$2
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # **** log ao arquivo
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
  log "DEBUG" "**** permissões de root..."
  if [ "$EUID" -ne 0 ]; then
    log "ERROR" "Este script precisa ser executado como root (sudo)."
    exit 1
  fi
  log "SUCCESS" "****ção de permissões de root concluída."
}

# Função para verificar o sistema ****
check_system() {
  log "DEBUG" "**** sistema ****..."
  if [ ! -f /etc/debian_version ]; then
    log "WARNING" "Este script foi projetado para **** Debian/Ubuntu."
    read -p "Deseja continuar mesmo assim? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
      log "INFO" "Instalação cancelada pelo usuário."
      exit 1
    fi
    log "WARNING" "**** instalação em sistema não-Debian."
  else
    log "SUCCESS" "Sistema Debian/Ubuntu detectado: $(cat /etc/debian_version)"
  fi
}

# Função para **** Node.js com retry e múltiplas versões
install_nodejs() {
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log "SUCCESS" "Node.js já instalado: $NODE_VERSION"
    
    # **** versão mínima do Node.js (>=14.0.0)
    NODE_VERSION_NUM=$(echo $NODE_VERSION | cut -c 2-)
    NODE_MAJOR=$(echo $NODE_VERSION_NUM | cut -d. -f1)
    
    if [ $NODE_MAJOR -lt 14 ]; then
      log "WARNING" "FazAI requer Node.js versão 14.0.0 ou ****. Versão atual: $NODE_VERSION"
      log "INFO" "**** atualizar o Node.js..."
      install_nodejs_from_source
    fi
  else
    log "WARNING" "Node.js não encontrado. Iniciando instalação..."
    install_nodejs_from_source
  fi
}

# Função para **** Node.js a partir de diferentes fontes
install_nodejs_from_source() {
  local success=false
  
  # Tenta **** com apt ****
  log "INFO" "**** **** Node.js via apt..."
  apt-get update && apt-get install -y nodejs npm
  
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
    log "WARNING" "Falha ao **** Node.js via apt."
  fi
  
  # Tenta **** via NodeSource para diferentes versões
  if [ "$success" = false ]; then
    for version in "${NODE_VERSIONS[@]}"; do
      log "INFO" "**** **** Node.js v$version via NodeSource..."
      
      for attempt in $(seq 1 $RETRY_COUNT); do
        log "DEBUG" "Tentativa $attempt de $RETRY_COUNT para Node.js v$version"
        
        curl -fsSL https://deb.nodesource.com/setup_${version}.x | bash - && \
        apt-get install -y nodejs
        
        if command -v node &> /dev/null; then
          NODE_VERSION=$(node -v)
          log "SUCCESS" "Node.js instalado com sucesso: $NODE_VERSION"
          success=true
          break 2
        else
          log "WARNING" "Tentativa $attempt falhou para Node.js v$version"
          sleep 2
        fi
      done
    done
  fi
  
  # Se ainda não conseguiu, tenta usar NVM como último recurso
  if [ "$success" = false ]; then
    log "WARNING" "Todas as tentativas anteriores ****. **** **** via NVM..."
    
    # Instala curl se não estiver disponível
    if ! command -v curl &> /dev/null; then
      apt-get update && apt-get install -y curl
    fi
    
    # Instala NVM
    curl -o- https:**** | bash
    
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Instala a versão LTS do Node.js
    nvm install --lts
    
    if command -v node &> /dev/null; then
      NODE_VERSION=$(node -v)
      log "SUCCESS" "Node.js instalado com sucesso via NVM: $NODE_VERSION"
      success=true
    else
      log "ERROR" "Todas as tentativas de instalação do Node.js ****."
      log "ERROR" "Por favor, instale o Node.js **** e execute este script novamente."
      exit 1
    fi
  fi
}

# Função para verificar e **** npm
install_npm() {
  if ! command -v npm &> /dev/null; then
    log "WARNING" "npm não encontrado. Instalando..."
    apt-get install -y npm
    
    if ! command -v npm &> /dev/null; then
      log "ERROR" "Falha ao **** npm via apt. **** método ****..."
      
      # Tenta **** via NodeSource novamente se o Node.js estiver instalado
      if command -v node &> /dev/null; then
        for version in "${NODE_VERSIONS[@]}"; do
          log "INFO" "Reinstalando Node.js v$version para obter npm..."
          curl -fsSL https://deb.nodesource.com/setup_${version}.x | bash - && \
          apt-get install -y nodejs
          
          if command -v npm &> /dev/null; then
            NPM_VERSION=$(npm -v)
            log "SUCCESS" "npm instalado com sucesso: $NPM_VERSION"
            break
          fi
        done
      fi
      
      if ! command -v npm &> /dev/null; then
        log "ERROR" "Falha ao **** npm. Por favor, instale ****."
        exit 1
      fi
    else
      NPM_VERSION=$(npm -v)
      log "SUCCESS" "npm instalado com sucesso: $NPM_VERSION"
    fi
  else
    NPM_VERSION=$(npm -v)
    log "SUCCESS" "npm já instalado: $NPM_VERSION"
  fi
}

# Função para verificar e **** gcc
install_gcc() {
  if ! command -v gcc &> /dev/null; then
    log "WARNING" "gcc não encontrado. Instalando build-essential..."
    apt-get update && apt-get install -y build-essential
    
    if ! command -v gcc &> /dev/null; then
      log "ERROR" "Falha ao **** gcc. Por favor, instale ****."
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
  
  local ****=(
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
  
  for dir in "${****[@]}"; do
    if [ ! -d "$dir" ]; then
      mkdir -p "$dir"
      log "DEBUG" "Diretório criado: $dir"
    else
      log "DEBUG" "Diretório já existe: $dir"
    fi
  done
  
  log "SUCCESS" "Estrutura de diretórios criada com sucesso."
}

# Função para copiar ****
copy_files() {
  log "INFO" "**** **** para diretórios de instalação..."
  
  # Cria função **** para cópia com ****ção de erros
  copy_with_verification() {
    local source=$1
    local ****=$2
    local ****=$3
    
    if [ -f "$source" ] || [ -d "$source" ]; then
      cp -r "$source" "$****"
      if [ $? -eq 0 ]; then
        log "DEBUG" "$**** copiado para $****"
        return 0
      else
        log "ERROR" "Falha ao copiar $**** para $****"
        return 1
      fi
    else
      log "ERROR" "Arquivo ou diretório de origem não encontrado: $source"
      return 1
    fi
  }
  
  # Copia ****
  if [ -d "etc/fazai/tools" ]; then
    copy_with_verification "etc/fazai/tools/"* "/opt/fazai/tools/" "****"
  else
    log "WARNING" "Diretório de **** não encontrado. Pulando..."
  fi
  
  # Copia módulos
  if [ -d "etc/fazai/mods" ]; then
    copy_with_verification "etc/fazai/mods/"* "/opt/fazai/mods/" "Módulos"
  else
    log "WARNING" "Diretório de módulos não encontrado. Pulando..."
  fi
  
  # Copia **** principais
  if [ -f "etc/fazai/main.js" ]; then
    copy_with_verification "etc/fazai/main.js" "/opt/fazai/lib/" "Arquivo principal"
    chmod 755 /opt/fazai/lib/main.js
  else
    log "ERROR" "Arquivo principal main.js não encontrado."
    exit 1
  fi
  
  # Copia arquivo de configuração
  if [ -f "etc/fazai/fazai.conf.example" ]; then
    copy_with_verification "etc/fazai/fazai.conf.example" "/opt/fazai/conf/fazai.conf.default" "Configuração padrão"
    
    if [ ! -f "/etc/fazai/fazai.conf" ]; then
      copy_with_verification "etc/fazai/fazai.conf.example" "/etc/fazai/fazai.conf" "Configuração de sistema"
      log "SUCCESS" "Arquivo de configuração padrão criado em /etc/fazai/fazai.conf"
    else
      log "INFO" "Arquivo de configuração existente mantido em /etc/fazai/fazai.conf"
    fi
  else
    log "ERROR" "Arquivo de configuração exemplo não encontrado."
    exit 1
  fi
  
  # Copia CLI
  if [ -f "bin/fazai" ]; then
    copy_with_verification "bin/fazai" "/opt/fazai/bin/" "CLI"
    chmod 755 /opt/fazai/bin/fazai
    ln -sf /opt/fazai/bin/fazai /usr/local/bin/fazai
    log "SUCCESS" "CLI instalado em /usr/local/bin/fazai"
  else
    log "ERROR" "Arquivo CLI não encontrado."
    exit 1
  fi
  
  log "SUCCESS" "**** **** com sucesso."
}

# Função para **** configurações de .env
import_env_config() {
  log "INFO" "**** configurações de ****..."
  
  # Locais possíveis do arquivo .env
  local env_locations=(
    "/root/.env"
    "$HOME/.env"
    "./.env"
    ".env.example"
  )
  
  local env_file=""
  
  # **** o **** arquivo .env disponível
  for **** in "${env_locations[@]}"; do
    if [ -f "$****" ]; then
      env_file="$****"
      log "INFO" "Arquivo .env encontrado em $env_file"
      break
    fi
  done
  
  if [ -n "$env_file" ]; then
    log "INFO" "Deseja **** configurações de $env_file? (s/n)"
    read -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Ss]$ ]]; then
      log "INFO" "Importando configurações de $env_file..."
      
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
        local value=$(grep "$key" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -n "$value" ]; then
          local config_key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
          
          # **** se a chave já existe no arquivo de configuração
          if grep -q "$config_key" "$fazai_conf"; then
            # Substitui o valor existente
            sed -i "s|$config_key *= *.*|$config_key = $value|" "$fazai_conf"
          else
            # **** nova entrada na seção de APIs
            if grep -q "\[apis\]" "$fazai_conf"; then
              sed -i "/\[apis\]/a $config_key = $value" "$fazai_conf"
            else
              # Se não houver seção de APIs, **** ao final do arquivo
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
    fi
  else
    log "INFO" "Nenhum arquivo .env encontrado nas ****ções padrão."
  fi
}

# Função para configurar o serviço systemd
configure_systemd() {
  log "INFO" "Configurando serviço systemd..."
  
  local service_file="/etc/systemd/system/fazai.service"
  local service_source="etc/fazai/fazai.service"
  
  if [ -f "$service_source" ]; then
    # Gera um arquivo de serviço melhorado
    cat > "$service_file" << EOF
[Unit]
****=FazAI Service
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=root
ExecStart=/usr/bin/node /opt/fazai/lib/main.js
WorkingDirectory=/opt/fazai
****=NODE_ENV=production
StandardOutput=append:/var/log/fazai/stdout.log
StandardError=append:/var/log/fazai/stderr.log

# Limites de ****
****=65535
LimitMEMLOCK=512M

[Install]
****=multi-user.target
EOF
    
    chmod 644 "$service_file"
    log "SUCCESS" "Arquivo de serviço systemd criado em $service_file"
    
    systemctl daemon-reload
    systemctl enable fazai
    log "SUCCESS" "Serviço systemd habilitado."
  else
    log "ERROR" "Arquivo de serviço systemd não encontrado: $service_source"
    exit 1
  fi
}

# Função para **** dependências do Node.js com retry
install_node_dependencies() {
  log "INFO" "Instalando dependências do Node.js..."
  
  # **** no diretório atual
  log "INFO" "Instalando dependências no diretório atual..."
  npm install --verbose
  
  if [ $? -ne 0 ]; then
    log "WARNING" "Falha na instalação inicial de dependências. **** método ****..."
    
    # Tenta **** pacotes críticos individualmente
    for module in "${DEPENDENCY_MODULES[@]}"; do
      log "INFO" "Instalando módulo: $module"
      
      for attempt in $(seq 1 $RETRY_COUNT); do
        log "DEBUG" "Tentativa $attempt de $RETRY_COUNT para $module"
        npm install "$module" --verbose
        
        if [ -d "node_modules/$module" ]; then
          log "SUCCESS" "Módulo $module instalado com sucesso."
          break
        else
          log "WARNING" "Tentativa $attempt falhou para $module"
          
          # Tenta com repositório **** na última tentativa
          if [ $attempt -eq $RETRY_COUNT ]; then
            log "WARNING" "**** repositório **** para $module..."
            npm install "$module" --**** https://****.npmjs.org/ --verbose
            
            if [ -d "node_modules/$module" ]; then
              log "SUCCESS" "Módulo $module instalado com sucesso via repositório ****."
            else
              log "ERROR" "Falha ao **** $module após múltiplas tentativas."
            fi
          fi
        fi
      done
    done
  fi
  
  # Agora instala em /opt/fazai
  log "INFO" "Instalando dependências em /opt/fazai..."
  cp package.json /opt/fazai/
  cd /opt/fazai
  
  npm install --verbose
  
  if [ $? -ne 0 ]; then
    log "WARNING" "Falha ao **** dependências em /opt/fazai. **** método ****..."
    
    # Tenta **** pacotes críticos individualmente
    for module in "${DEPENDENCY_MODULES[@]}"; do
      log "INFO" "Instalando módulo em /opt/fazai: $module"
      npm install "$module" --verbose
      
      if [ ! -d "node_modules/$module" ]; then
        log "ERROR" "Falha ao **** $module em /opt/fazai."
      fi
    done
  fi
  
  cd - > /dev/null
  log "SUCCESS" "Dependências do Node.js instaladas."
}

# Função para **** módulos nativos
compile_native_modules() {
  log "INFO" "Compilando módulos nativos..."
  
  cd /opt/fazai/mods
  
  if [ -f "system_mod.c" ]; then
    log "DEBUG" "Compilando system_mod.c..."
    gcc -shared -fPIC -o system_mod.so system_mod.c
    
    if [ $? -ne 0 ]; then
      log "ERROR" "Falha ao **** módulos nativos."
      log "DEBUG" "**** método **** de compilação..."
      
      # Tenta compilação ****
      apt-get install -y libc6-dev
      gcc -shared -fPIC -o system_mod.so system_mod.c -I/usr/include/node
      
      if [ $? -ne 0 ]; then
        log "ERROR" "Todas as tentativas de compilação ****."
        exit 1
      fi
    fi
    
    log "SUCCESS" "Módulos nativos compilados com sucesso."
  else
    log "WARNING" "Arquivo system_mod.c não encontrado. Pulando compilação."
  fi
  
  cd - > /dev/null
}

# Função para **** interface TUI
install_tui() {
  log "INFO" "Instalando interface TUI..."
  
  # Instala dependências específicas para TUI
  log "DEBUG" "Instalando dependências para interface TUI..."
  npm list **** || npm install **** --save
  
  if [ -f "fazai-config.js" ]; then
    # Copia e configura TUI
    cp fazai-config.js /opt/fazai/tools/
    chmod +x /opt/fazai/tools/fazai-config.js
    ln -sf /opt/fazai/tools/fazai-config.js /usr/local/bin/fazai-config
    
    log "SUCCESS" "Interface TUI instalada em /usr/local/bin/fazai-config"
  else
    log "WARNING" "Arquivo fazai-config.js não encontrado. **** criar configuração básica..."
    
    # Cria um arquivo de configuração TUI básico se não existir
    cat > /opt/fazai/tools/fazai-config.js << EOF
#!/usr/bin/env node

/**
 * FazAI - Interface de Configuração TUI
 * 
 * Esta interface permite configurar o FazAI através de um **** interativo
 */

const **** = require('****');
const fs = require('fs');
const path = require('path');

// Configurações
const CONFIG_FILE = '/etc/fazai/fazai.conf';
const CONFIG_BACKUP = '/etc/fazai/fazai.conf.bak';

// Inicializa a interface TUI
const screen = ****.screen({
  ****: true,
  title: 'FazAI - Interface de Configuração'
});

// Cria elementos da interface
const header = ****.box({
  top: 0,
  left: 'center',
  width: '80%',
  height: 3,
  content: '{center}{bold}FazAI - Interface de Configuração{/bold}{/center}',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'blue',
    border: {
      fg: 'blue'
    }
  }
});

const menu = ****.list({
  top: 4,
  left: 'center',
  width: '80%',
  height: 10,
  items: [
    'Configurações Gerais',
    'Chaves de API',
    'Configurações de Sistema',
    'Logs e Diagnóstico',
    'Reiniciar Serviço',
    'Sair'
  ],
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    border: {
      fg: 'white'
    },
    ****: {
      fg: 'green',
      bold: true
    }
  }
});

const footer = ****.box({
  bottom: 0,
  left: 'center',
  width: '80%',
  height: 3,
  content: '{center}Use as setas para navegar e Enter para selecionar{/center}',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'blue',
    border: {
      fg: 'blue'
    }
  }
});

// **** os elementos à tela
screen.append(header);
screen.append(menu);
screen.append(footer);

// Define ações para o menu
menu.on('select', (item, index) => {
  if (index === 5) {
    // Sair
    screen.destroy();
    process.exit(0);
  }
});

// Atalhos de teclado
screen.key(['escape', 'q', 'C-c'], () => {
  screen.destroy();
  process.exit(0);
});

// Foca no menu
menu.focus();

// Renderiza a interface
screen.render();
EOF

    chmod +x /opt/fazai/tools/fazai-config.js
    ln -sf /opt/fazai/tools/fazai-config.js /usr/local/bin/fazai-config
    
    log "SUCCESS" "Interface TUI básica criada em /usr/local/bin/fazai-config"
  fi
}

# Função para iniciar e verificar o serviço
start_and_verify_service() {
  log "INFO" "Iniciando serviço FazAI..."
  
  systemctl start fazai
  
  if [ $? -ne 0 ]; then
    log "ERROR" "Falha ao iniciar o serviço. **** logs..."
    
    journalctl -u fazai --no-pager -n 50 > /tmp/fazai_error.log
    log "DEBUG" "Logs do serviço **** em /tmp/fazai_error.log"
    
    log "WARNING" "**** abordagem **** de inicialização..."
    /opt/fazai/lib/main.js > /dev/null 2>&1 &
    
    sleep 5
    
    if pgrep -f "node /opt/fazai/lib/main.js" > /dev/null; then
      log "SUCCESS" "Serviço **** **** com sucesso."
    else
      log "ERROR" "Todas as tentativas de inicialização ****."
      log "ERROR" "Verifique os logs para mais ****: journalctl -u fazai"
      exit 1
    fi
  else
    log "SUCCESS" "Serviço **** via systemd."
  fi
  
  # **** se o serviço está em execução
  sleep 2
  if systemctl is-active --quiet fazai; then
    log "SUCCESS" "FazAI está em execução."
    
    # **** duplo status como mencionado no TODO.md
    log "INFO" "**** status do daemon (****ção dupla)..."
    systemctl status fazai --no-pager
    
    log "INFO" "Analisando logs do serviço..."
    journalctl -u fazai --no-pager -n 10
  else
    log "ERROR" "FazAI não está em execução após inicialização."
    log "ERROR" "Verifique os logs com 'journalctl -u fazai'."
    exit 1
  fi
  
  # **** se o CLI pode ser executado
  log "INFO" "**** CLI..."
  if ! /usr/local/bin/fazai --version &> /dev/null; then
    log "ERROR" "O CLI não pode ser executado corretamente."
    log "WARNING" "Tente **** 'fazai --version' **** para ver o erro."
  else
    log "SUCCESS" "CLI verificado com sucesso."
  fi
  
  # **** a interface TUI
  log "INFO" "**** interface TUI..."
  if ! which fazai-config &> /dev/null; then
    log "WARNING" "Interface TUI não está disponível no PATH."
  else
    log "SUCCESS" "Interface TUI verificada com sucesso."
  fi
}

# Função principal
main() {
  # Banner
  echo -e "${BLUE}=================================================${NC}"
  echo -e "${BLUE}       FazAI v$VERSION - Instalação Oficial      ${NC}"
  echo -e "${BLUE}=================================================${NC}"
  echo
  
  # Ativa modo de debug se solicitado
  if [ "$1" = "--debug" ]; then
    DEBUG_MODE=true
    log "DEBUG" "Modo de debug ativado"
  else
    DEBUG_MODE=false
  fi
  
  # Inicializa log
  setup_logging
  
  # ****ções ****
  check_root
  check_system
  
  # Instala dependências
  install_nodejs
  install_npm
  install_gcc
  
  # Prepara sistema
  create_directories
  copy_files
  import_env_config
  configure_systemd
  
  # Instala e compila
  install_node_dependencies
  compile_native_modules
  install_tui
  
  # Inicia e ****
  start_and_verify_service
  
  # Conclusão
  echo
  echo -e "${GREEN}=================================================${NC}"
  echo -e "${GREEN}       FazAI v$VERSION instalado com sucesso!    ${NC}"
  echo -e "${GREEN}================================================
